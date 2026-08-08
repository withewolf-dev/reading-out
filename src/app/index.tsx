import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ContinueCard } from '@/components/continue-card';
import { MiniPlayer } from '@/components/mini-player';
import { ShelfItem } from '@/components/shelf-item';
import {
  deleteReading,
  getReadingText,
  insertReading,
  listReadings,
  progressFraction,
  touchOpened,
  type ReadingRow,
} from '@/db';
import { pickAndReadDocuments } from '@/lib/import';
import { SAMPLE_TEXT, SAMPLE_TITLE } from '@/lib/sample';
import { countWords, makeSnippet } from '@/lib/text';
import { player, RATE, usePlayer, usePrefs } from '@/speech/engine';
import { Colors, Fonts, Radius, Screen, Space } from '@/theme';

export default function LibraryScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const state = usePlayer();
  const { rate } = usePrefs();
  const [readings, setReadings] = useState<ReadingRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  const reload = useCallback(() => {
    listReadings(db).then(setReadings).catch(() => setReadings([]));
  }, [db]);

  useFocusEffect(reload);

  const open = useCallback(
    (id: number) => {
      touchOpened(db, id).catch(() => {});
      router.push(`/reader/${id}`);
    },
    [db, router]
  );

  const save = useCallback(
    async (title: string, text: string, coverPath?: string | null) => {
      const id = await insertReading(
        db,
        { title, text, coverPath },
        { charCount: text.length, wordCount: countWords(text), snippet: makeSnippet(text) }
      );
      reload();
      return id;
    },
    [db, reload]
  );

  const importFiles = useCallback(async () => {
    const result = await pickAndReadDocuments(() => setBusy('Reading the file…'));
    if (!result) {
      setBusy(null);
      return;
    }
    try {
      for (const doc of result.imported) await save(doc.title, doc.text, doc.coverPath);
      if (result.failed.length > 0) {
        Alert.alert(
          result.imported.length > 0 ? 'Some files could not be imported' : "That file can't be read",
          result.failed.map((f) => `${f.name}\n${f.reason}`).join('\n\n')
        );
      }
    } finally {
      setBusy(null);
    }
  }, [save]);

  const playReading = useCallback(
    async (reading: ReadingRow) => {
      if (player.isLoaded(reading.id)) {
        player.toggle();
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const text = await getReadingText(db, reading.id);
      const done = reading.finished_at != null || progressFraction(reading) >= 1;
      player.play({ id: reading.id, title: reading.title, text }, done ? 0 : reading.progress_offset);
      touchOpened(db, reading.id).catch(() => {});
      reload();
    },
    [db, reload]
  );

  const confirmDelete = useCallback(
    (reading: ReadingRow) => {
      Alert.alert(reading.title, 'Delete this reading?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (player.isLoaded(reading.id)) player.stop();
            await deleteReading(db, reading.id);
            reload();
          },
        },
      ]);
    },
    [db, reload]
  );

  const hero = readings?.find((r) => r.finished_at == null) ?? readings?.[0] ?? null;
  const shelf = readings?.filter((r) => r.id !== hero?.id) ?? [];
  const nowPlaying = readings?.find((r) => r.id === state.readingId);
  // `rate` is AVFoundation's own 0…1 scale, so normalise it before turning
  // words into minutes.
  const wordsPerMinute = 180 * (rate / RATE.default);

  return (
    <View style={styles.screen}>
      {/* Title and toolbar on one row. */}
      <View style={[styles.bar, { paddingTop: insets.top + Space.s }]}>
        <Text style={styles.barTitle}>Library</Text>
        <View style={styles.headerButtons}>
          <HeaderIcon
            symbol="plus"
            label="Import a file"
            onPress={importFiles}
            onLongPress={() => router.push('/composer')}
          />
          <HeaderIcon symbol="gearshape" label="Voice and text settings" onPress={() => router.push('/settings')} />
        </View>
      </View>

      {readings == null ? null : readings.length === 0 ? (
        <EmptyLibrary
          onImport={importFiles}
          onPaste={() => router.push('/composer')}
          onSample={async () => {
            const id = await save(SAMPLE_TITLE, SAMPLE_TEXT);
            open(id);
          }}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          {hero ? (
            <ContinueCard
              reading={hero}
              isPlaying={state.readingId === hero.id && state.status === 'speaking'}
              wordsPerMinute={wordsPerMinute}
              onOpen={() => open(hero.id)}
              onTogglePlay={() => playReading(hero)}
              onLongPress={() => confirmDelete(hero)}
            />
          ) : null}

          {shelf.length > 0 ? (
            <View style={styles.shelfSection}>
              <Text style={styles.sectionTitle}>Everything else</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.shelf}>
                {shelf.map((reading) => (
                  <ShelfItem
                    key={reading.id}
                    reading={reading}
                    onPress={() => open(reading.id)}
                    onLongPress={() => confirmDelete(reading)}
                  />
                ))}
              </ScrollView>
            </View>
          ) : null}
        </ScrollView>
      )}

      {busy ? (
        <View style={styles.busy}>
          <Text style={styles.busyText}>{busy}</Text>
        </View>
      ) : null}

      <MiniPlayer
        onOpen={open}
        coverPath={nowPlaying?.cover_path}
        wordCount={nowPlaying?.word_count}
      />
    </View>
  );
}

function HeaderIcon({
  symbol,
  label,
  onPress,
  onLongPress,
}: {
  symbol: string;
  label: string;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  return (
    <Pressable hitSlop={10} onPress={onPress} onLongPress={onLongPress} accessibilityRole="button" accessibilityLabel={label}>
      <SymbolView name={symbol as never} size={20} tintColor={Colors.accent} fallback={<Text style={{ color: Colors.accent }}>{label}</Text>} />
    </Pressable>
  );
}

/** The empty state IS the onboarding: it teaches, motivates, and guides (§8). */
function EmptyLibrary({
  onImport,
  onPaste,
  onSample,
}: {
  onImport: () => void;
  onPaste: () => void;
  onSample: () => void;
}) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>Nothing here yet.</Text>
      <Text style={styles.emptyBody}>
        Bring in a document and ReadingLoud reads it aloud — highlighting each word as it goes.
        Everything stays on this device.
      </Text>
      <View style={styles.doors}>
        <Door label="Import a file" primary onPress={onImport} />
        <Door label="Paste text" onPress={onPaste} />
        <Door label="Try a sample" onPress={onSample} />
      </View>
    </View>
  );
}

function Door({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.door,
        primary && styles.doorPrimary,
        pressed && { opacity: 0.6 },
      ]}>
      <Text style={[styles.doorLabel, primary && styles.doorLabelPrimary]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.ground },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Screen.margin,
    paddingBottom: Space.ms,
  },
  barTitle: { fontFamily: Fonts.sans, fontSize: 34, fontWeight: '700', color: Colors.primary },
  content: { paddingTop: Space.s, paddingBottom: 120, gap: Space.xl },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    // Roomy: iOS 26 wraps these in a glass pill, and tight icons make it look
    // cramped against its own capsule.
    gap: 30,
    paddingHorizontal: 6,
  },
  sectionTitle: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.inactive,
    marginHorizontal: Screen.margin,
    marginBottom: Space.m,
  },
  shelfSection: { gap: 0 },
  shelf: { paddingHorizontal: Screen.margin, gap: Space.l },
  empty: { flex: 1, justifyContent: 'center', paddingHorizontal: Screen.margin, gap: Space.m },
  emptyTitle: { fontFamily: Fonts.serif, fontSize: 28, color: Colors.primary },
  emptyBody: { fontFamily: Fonts.sans, fontSize: 15, lineHeight: 22, color: Colors.inactive },
  doors: { marginTop: Space.l, gap: Space.m },
  door: {
    paddingVertical: Space.ms,
    borderRadius: Radius.card,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.stroke,
    backgroundColor: Colors.surface,
  },
  doorPrimary: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  doorLabel: { fontFamily: Fonts.sans, fontSize: 16, color: Colors.primary },
  doorLabelPrimary: { color: Colors.ground, fontWeight: '600' },
  busy: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.scrim,
  },
  busyText: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    color: Colors.primary,
    backgroundColor: Colors.ground,
    paddingHorizontal: Space.xl,
    paddingVertical: Space.l,
    borderRadius: Radius.card,
    overflow: 'hidden',
  },
});
