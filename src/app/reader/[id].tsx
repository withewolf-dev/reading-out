import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { mark, sinceStart } from '@/lib/perf';

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
  const params = useLocalSearchParams<{ id: string; cover?: string }>();

  // Handed over by the library through the route. Params are serialised, so the
  // asset handle arrives as a string; the asset registry still resolves it once
  // it is a number again.
  const cover = params.cover ? Number(params.cover) : null;

  // Captured during the very first render, before React has committed anything.
  // There are no effects left anywhere in the app, so this is the only moment
  // this screen can measure — `tap → commit` and `tap → next frame` needed a
  // `useEffect` and a `requestAnimationFrame` to observe, and both are gone.
  const firstRender = useRef(sinceStart()).current;

  // Emitted to the console, which reaches Metro, so a tap can be read off the
  // terminal rather than screenshotted.
  const logged = useRef(false);
  if (!logged.current) {
    logged.current = true;
    mark(`reader first render (cover=${params.cover || 'none'})`);
  }

  return (
    <View style={styles.screen}>
      {cover != null && Number.isFinite(cover) ? (
        <Image source={cover} style={styles.cover} contentFit="cover" />
      ) : (
        <View style={[styles.cover, styles.coverEmpty]} />
      )}
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
  cover: { width: 160, height: 232, borderRadius: 8, backgroundColor: '#E5E5EA', marginBottom: 28 },
  coverEmpty: { backgroundColor: '#D1D1D6' },
  book: { fontSize: 15, color: '#8A8A8E', marginBottom: 28 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  label: { fontSize: 17, color: '#3A3A3C' },
  value: { fontSize: 22, fontWeight: '700', color: '#000000', fontVariant: ['tabular-nums'] },
  note: { fontSize: 13, color: '#8A8A8E', marginTop: 28, lineHeight: 18 },
});
