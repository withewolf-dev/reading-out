import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ContinueCard } from '@/components/continue-card';
import { MiniPlayer } from '@/components/mini-player';
import { ShelfItem } from '@/components/shelf-item';
import {
  deleteReading,
  getReadingText,
  insertReading,
  listReadings,
  touchOpened,
  type ReadingRow,
} from '@/db';
import { catalogBook } from '@/lib/catalog';
import { pickAndReadDocuments } from '@/lib/import';
import {
  buildLibrary,
  ensureReading,
  startOffset,
  type LibraryEntry,
  type LibraryShelf,
} from '@/lib/library';
import { countWords, makeSnippet } from '@/lib/text';
import { player, RATE, usePlayer, usePrefs } from '@/speech/engine';
import { Colors, Fonts, Screen, Space } from '@/theme';

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

  // The catalogue is static and the rows are few, so the whole shelf layout is
  // rebuilt only when the readings change.
  const library = useMemo(() => buildLibrary(readings ?? []), [readings]);

  /** A bundled book becomes a row the first time it is opened. */
  const openEntry = useCallback(
    async (entry: LibraryEntry) => {
      let id = entry.row?.id;
      if (id == null && entry.book) {
        setBusy('Opening…');
        try {
          id = (await ensureReading(db, entry.book)).id;
        } catch {
          setBusy(null);
          Alert.alert(entry.title, 'That book could not be opened.');
          return;
        }
        setBusy(null);
      }
      if (id == null) return;
      touchOpened(db, id).catch(() => {});
      router.push(`/reader/${id}`);
    },
    [db, router]
  );

  const importFiles = useCallback(async () => {
    const result = await pickAndReadDocuments(() => setBusy('Reading the file…'));
    if (!result) {
      setBusy(null);
      return;
    }
    try {
      for (const doc of result.imported) {
        await insertReading(
          db,
          { title: doc.title, text: doc.text, coverPath: doc.coverPath },
          {
            charCount: doc.text.length,
            wordCount: countWords(doc.text),
            snippet: makeSnippet(doc.text),
          }
        );
      }
      reload();
      if (result.failed.length > 0) {
        Alert.alert(
          result.imported.length > 0 ? 'Some files could not be imported' : "That file can't be read",
          result.failed.map((f) => `${f.name}\n${f.reason}`).join('\n\n')
        );
      }
    } finally {
      setBusy(null);
    }
  }, [db, reload]);

  const playEntry = useCallback(
    async (entry: LibraryEntry) => {
      if (entry.row && player.isLoaded(entry.row.id)) {
        player.toggle();
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // Playing a book that has never been opened has to materialise it first —
      // the same path as opening it, so progress lands in the same row.
      let loaded: { id: number; text: string };
      if (entry.row) loaded = { id: entry.row.id, text: await getReadingText(db, entry.row.id) };
      else if (entry.book) loaded = await ensureReading(db, entry.book);
      else return;

      player.play({ id: loaded.id, title: entry.title, text: loaded.text }, startOffset(entry));
      touchOpened(db, loaded.id).catch(() => {});
      reload();
    },
    [db, reload]
  );

  /** Long press removes progress, not the book: a bundled book cannot be deleted. */
  const confirmReset = useCallback(
    (entry: LibraryEntry) => {
      if (!entry.row) return;
      const row = entry.row;
      const bundled = row.catalog_id != null;
      Alert.alert(
        entry.title,
        bundled ? 'Forget your place in this book?' : 'Delete this reading?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: bundled ? 'Forget' : 'Delete',
            style: 'destructive',
            onPress: async () => {
              if (player.isLoaded(row.id)) player.stop();
              await deleteReading(db, row.id);
              reload();
            },
          },
        ]
      );
    },
    [db, reload]
  );

  const nowPlayingRow = readings?.find((r) => r.id === state.readingId);
  const nowPlayingBook = catalogBook(nowPlayingRow?.catalog_id);
  // `rate` is AVFoundation's own 0…1 scale, so normalise it before turning
  // words into minutes.
  const wordsPerMinute = 180 * (rate / RATE.default);

  const renderShelf = useCallback(
    ({ item: shelf }: { item: LibraryShelf }) => (
      <View style={styles.shelfSection}>
        <Text style={styles.sectionTitle}>{shelf.title}</Text>
        {shelf.subtitle ? <Text style={styles.sectionSubtitle}>{shelf.subtitle}</Text> : null}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.shelf}>
          {shelf.items.map((entry) => (
            <ShelfItem
              key={entry.key}
              entry={entry}
              isPlaying={
                entry.row != null &&
                state.readingId === entry.row.id &&
                state.status === 'speaking'
              }
              onPress={() => openEntry(entry)}
              onPlay={() => playEntry(entry)}
              onLongPress={() => confirmReset(entry)}
            />
          ))}
        </ScrollView>
      </View>
    ),
    [confirmReset, openEntry, playEntry, state.readingId, state.status]
  );

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

      {readings == null ? null : (
        <FlatList
          data={library.shelves}
          keyExtractor={(shelf) => shelf.id}
          renderItem={renderShelf}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          // Fifteen shelves of artwork is more than one screen can afford to
          // decode at once.
          initialNumToRender={3}
          maxToRenderPerBatch={3}
          windowSize={5}
          ListHeaderComponent={
            library.continuing ? (
              <ContinueCard
                entry={library.continuing}
                isPlaying={
                  state.readingId === library.continuing.row?.id && state.status === 'speaking'
                }
                wordsPerMinute={wordsPerMinute}
                onOpen={() => openEntry(library.continuing!)}
                onTogglePlay={() => playEntry(library.continuing!)}
                onLongPress={() => confirmReset(library.continuing!)}
              />
            ) : (
              <Text style={styles.intro}>
                Fifty books, ready to be read aloud. Pick one and press play — ReadingLoud
                highlights each word as it goes, and remembers where you stopped.
              </Text>
            )
          }
        />
      )}

      {busy ? (
        <View style={styles.busy}>
          <Text style={styles.busyText}>{busy}</Text>
        </View>
      ) : null}

      <MiniPlayer
        onOpen={(id) => router.push(`/reader/${id}`)}
        coverPath={nowPlayingBook?.cover ?? nowPlayingRow?.cover_path}
        wordCount={nowPlayingRow?.word_count}
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
  content: { paddingTop: Space.s, paddingBottom: 120 },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    // Roomy: iOS 26 wraps these in a glass pill, and tight icons make it look
    // cramped against its own capsule.
    gap: 30,
    paddingHorizontal: 6,
  },
  intro: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.inactive,
    marginHorizontal: Screen.margin,
  },
  sectionTitle: {
    fontFamily: Fonts.sans,
    fontSize: 20,
    fontWeight: '700',
    color: Colors.primary,
    marginHorizontal: Screen.margin,
  },
  sectionSubtitle: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.inactive,
    marginHorizontal: Screen.margin,
    marginTop: 2,
  },
  shelfSection: { marginTop: Space.xl },
  shelf: { paddingHorizontal: Screen.margin, paddingTop: Space.m, gap: Space.l },
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
    borderRadius: 14,
    overflow: 'hidden',
  },
});
