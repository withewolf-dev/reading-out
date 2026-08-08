import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';

import { migrate } from '@/db';

/**
 * The whole app shell. Everything else — theme, components, speech engine,
 * settings, the reader's own UI — has been deleted. What is left is the
 * catalogue, SQLite, and enough of a stack to tap through.
 */
export default function RootLayout() {
  return (
    <SQLiteProvider
      databaseName="readingloud.db"
      onInit={migrate}
      useSuspense={false}
      options={{ useNewConnection: false }}>
      <Stack>
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

export const unstable_settings = { initialRouteName: 'index' };
