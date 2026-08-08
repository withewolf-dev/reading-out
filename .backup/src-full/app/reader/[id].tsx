import { useLocalSearchParams } from 'expo-router';
import { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { sinceStart } from '@/lib/perf';

/**
 * STRIPPED FOR MEASUREMENT — every piece of business logic is gone. No SQLite,
 * no speech engine, no preferences, no native ReaderView, no assets, no
 * effects that touch anything. Pushing to this screen is pure navigation, so
 * whatever time still passes between the tap and these numbers appearing
 * belongs to React Navigation and UIKit rather than to this app's code.
 *
 * The real screen is preserved at `.backup/reader-id.tsx.bak`.
 */
export default function ReaderScreen() {
  const params = useLocalSearchParams<{ id: string }>();

  // Captured during the very first render, before React has committed anything.
  // There are no effects left anywhere in the app, so this is the only moment
  // this screen can measure — `tap → commit` and `tap → next frame` needed a
  // `useEffect` and a `requestAnimationFrame` to observe, and both are gone.
  const firstRender = useRef(sinceStart()).current;

  return (
    <View style={styles.screen}>
      <Text style={styles.book}>{params.id}</Text>
      <Row label="tap → first render" value={firstRender} />
      <Text style={styles.note}>
        Nothing else runs on this screen. No database, no text, no native view,
        no effects.
      </Text>
    </View>
  );
}

function Row({ label, value }: { label: string; value: number | null }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value == null ? '…' : `${value} ms`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF', paddingHorizontal: 24, paddingTop: 120 },
  book: { fontSize: 15, color: '#8A8A8E', marginBottom: 28 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  label: { fontSize: 17, color: '#3A3A3C' },
  value: { fontSize: 22, fontWeight: '700', color: '#000000', fontVariant: ['tabular-nums'] },
  note: { fontSize: 13, color: '#8A8A8E', marginTop: 28, lineHeight: 18 },
});
