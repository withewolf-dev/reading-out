import { Stack } from 'expo-router';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { getSettings, migrate, saveProgress, setFinished } from '@/db';
import { configurePlayer, DEFAULT_PREFS, player, prefs } from '@/speech/engine';
import { Colors } from '@/theme';

export default function RootLayout() {
  return (
    <SQLiteProvider
      databaseName="readingloud.db"
      onInit={migrate}
      useSuspense={false}
      options={{ useNewConnection: false }}>
      <StatusBar style="light" />
      <PlaybackBridge />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.ground },
          headerTintColor: Colors.primary,
          headerTitleStyle: { color: Colors.primary },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: Colors.ground },
        }}>
        <Stack.Screen name="index" options={{ title: 'Library', headerLargeTitle: true }} />
        <Stack.Screen name="reader/[id]" options={{ title: '', headerBackTitle: 'Library' }} />
        <Stack.Screen
          name="composer"
          options={{
            title: 'New reading',
            presentation: 'formSheet',
            sheetGrabberVisible: true,
            sheetAllowedDetents: [0.999],
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            title: 'Voice & Text',
            presentation: 'formSheet',
            sheetGrabberVisible: true,
            sheetAllowedDetents: [0.6, 0.999],
            sheetInitialDetentIndex: 0,
          }}
        />
      </Stack>
    </SQLiteProvider>
  );
}

/**
 * Wires the engine to storage: throttled progress writes, a flush on background
 * (§17.8), and the finished state.
 */
function PlaybackBridge() {
  const db = useSQLiteContext();

  useEffect(() => {
    configurePlayer({
      persist: (id, offset) => {
        saveProgress(db, id, offset).catch(() => {});
      },
      onFinished: (id) => {
        setFinished(db, id, true).catch(() => {});
      },
    });

    getSettings(db)
      .then((stored) => {
        prefs.set({
          voice: stored.voice ?? DEFAULT_PREFS.voice,
          rate: stored.rate ? Number(stored.rate) : DEFAULT_PREFS.rate,
          pitch: stored.pitch ? Number(stored.pitch) : DEFAULT_PREFS.pitch,
          fontSize: stored.fontSize ? Number(stored.fontSize) : DEFAULT_PREFS.fontSize,
        });
      })
      .catch(() => {});

    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') player.flushProgress();
    });
    return () => subscription.remove();
  }, [db]);

  return null;
}

export const unstable_settings = { initialRouteName: 'index' };
