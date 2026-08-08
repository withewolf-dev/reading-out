import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';

import { migrate } from '@/db';
import { Colors } from '@/theme';

export default function RootLayout() {
  return (
    <SQLiteProvider
      databaseName="readingloud.db"
      onInit={migrate}
      useSuspense={false}
      options={{ useNewConnection: false }}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.ground },
          headerTintColor: Colors.primary,
          headerTitleStyle: { color: Colors.primary },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: Colors.ground },
        }}>
        {/* The library draws its own bar: iOS always drops a large title onto a
            second line below the toolbar, and we want the title and the icons
            on one row. */}
        <Stack.Screen name="index" options={{ title: 'Library', headerShown: false }} />
        <Stack.Screen name="reader/[id]" options={{ title: '', headerBackTitle: 'Library' }} />
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
      </Stack>
    </SQLiteProvider>
  );
}

export const unstable_settings = { initialRouteName: 'index' };
