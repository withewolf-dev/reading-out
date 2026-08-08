import { Stack } from 'expo-router';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
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
      <PlaybackBridge />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.ground },
          headerTintColor: Colors.primary,
          headerTitleStyle: { color: Colors.primary },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: Colors.ground },
        }}>
        {/* The library draws its own bar: iOS always drops a large title onto a
            second line below the toolbar, and we want the title on one row. */}
        <Stack.Screen name="index" options={{ title: 'Library', headerShown: false }} />
        <Stack.Screen
          name="settings"
          options={{
            presentation: 'formSheet',
            sheetGrabberVisible: true,
            // The sheet draws its own title row: a native nav bar inside a sheet
            // does not inset a scroll view reliably, and the first section ends
            // up hidden behind it.
            headerShown: false,
            // The voice list is long — open tall, but let it be pulled down.
            sheetAllowedDetents: [0.55, 0.999],
            sheetInitialDetentIndex: 1,
          }}
        />
        {/* Nothing at all across the top of the reader: no bar, no blur, no
            material, no scroll edge effect. Any of them draws a band with a
            visible seam against the tinted page. Only the back button is left,
            floating in its own glass pill. */}
        <Stack.Screen
          name="reader/[id]"
          options={{
            title: '',
            headerTransparent: true,
            headerShadowVisible: false,
            headerStyle: { backgroundColor: 'transparent' },
            scrollEdgeEffects: {
              top: 'hidden',
              bottom: 'automatic',
              left: 'automatic',
              right: 'automatic',
            },
          }}
        />
      </Stack>
    </SQLiteProvider>
  );
}

/** How often a position is worth writing down while speech is running. */
const PROGRESS_INTERVAL_MS = 5_000;

/**
 * Wires the engine to storage: throttled progress writes, a flush whenever the
 * app leaves the foreground, and the finished state.
 *
 * The engine reports a position every second. Writing all of them would be
 * 3,600 updates an hour to persist a number that moves predictably, so they are
 * thinned to one every five seconds — with the last position always written on
 * pause, stop and backgrounding, which is when it actually matters.
 */
function PlaybackBridge() {
  const db = useSQLiteContext();

  useEffect(() => {
    let lastWrite = 0;
    let pending: { id: number; offset: number } | null = null;

    const flush = () => {
      if (!pending) return;
      const { id, offset } = pending;
      pending = null;
      lastWrite = Date.now();
      // The last flush runs from the cleanup, by which point a hot reload may
      // already have closed the connection underneath us.
      try {
        saveProgress(db, id, offset).catch(() => {});
      } catch {
        // the position is lost; the next play will write a fresh one
      }
    };

    configurePlayer({
      persist: (id, offset) => {
        pending = { id, offset };
        if (Date.now() - lastWrite >= PROGRESS_INTERVAL_MS) flush();
      },
      onFinished: (id) => {
        pending = null;
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
      if (next !== 'active') {
        player.flushProgress();
        flush();
      }
    });
    return () => {
      flush();
      subscription.remove();
    };
  }, [db]);

  return null;
}

export const unstable_settings = { initialRouteName: 'index' };
