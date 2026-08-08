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
        <Stack.Screen name="index" options={{ title: 'Library' }} />
        <Stack.Screen name="reader/[id]" options={{ title: '' }} />
      </Stack>
    </SQLiteProvider>
  );
}

export const unstable_settings = { initialRouteName: 'index' };
