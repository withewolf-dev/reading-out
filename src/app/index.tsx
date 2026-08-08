import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ContinueCard } from '@/components/continue-card';
import { MiniPlayer } from '@/components/mini-player';
import { CARD_WIDTH, ShelfItem } from '@/components/shelf-item';
import { mark, markStart } from '@/lib/perf'; // TEMPORARY instrumentation
import { buildLibrary, type LibraryEntry, type LibraryShelf } from '@/lib/library';
import { RATE, usePrefs } from '@/speech/engine';
import { Colors, Fonts, Screen, Space } from '@/theme';

/** One card plus the gap after it — the stride a horizontal shelf scrolls by. */
const CARD_STRIDE = CARD_WIDTH + Space.l;

/**
 * The shelves, as they were: a full-bleed cover per card, laid out in
 * horizontal rows by category.
 *
 * The library holds no state of its own any more. There are no reading rows, so
 * the shelves come straight from the catalogue and a tap carries everything the
 * reader needs in the route itself.
 */
export default function LibraryScreen() {
  const router = useRouter();
  const { rate } = usePrefs();
  const insets = useSafeAreaInsets();

  const library = useMemo(() => buildLibrary([]), []);

  // Three shelves only: Start here, One or two sittings, Popular classics.
  // Eleven rows is a lot of artwork to keep mounted for a screen that shows two
  // of them at a time.
  const shelves = useMemo(() => library.shelves.slice(0, 3), [library]);

  /** A tap pushes, and hands over the artwork, title and text asset with it. */
  const openEntry = useCallback(
    (entry: LibraryEntry) => {
      const book = entry.book;
      if (!book) return;
      markStart('tap'); // TEMPORARY instrumentation
      router.push({
        pathname: '/reader/[id]',
        params: {
          id: book.id,
          title: book.title,
          cover: book.cover == null ? '' : String(book.cover),
          text: String(book.text),
          bodyOffset: String(book.bodyOffset),
        },
      });
      mark('push returned'); // TEMPORARY instrumentation
    },
    [router]
  );

  // The cards still draw their play pill and take a long press; nothing is
  // behind either while playback lives on the reader.
  const noop = useCallback(() => {}, []);

  // `rate` is AVFoundation's own 0…1 scale, so normalise it before turning
  // words into minutes.
  const wordsPerMinute = 180 * (rate / RATE.default);

  const renderCard = useCallback(
    ({ item: entry }: { item: LibraryEntry }) => (
      <ShelfItem
        entry={entry}
        isPlaying={false}
        onPress={() => openEntry(entry)}
        onPlay={() => openEntry(entry)}
        onLongPress={noop}
      />
    ),
    [noop, openEntry]
  );

  const renderShelf = useCallback(
    ({ item: shelf }: { item: LibraryShelf }) => (
      <View style={styles.shelfSection}>
        <Text style={styles.sectionTitle}>{shelf.title}</Text>
        {shelf.subtitle ? <Text style={styles.sectionSubtitle}>{shelf.subtitle}</Text> : null}
        {/* A horizontal ScrollView mounts every card it holds, on-screen or
            not — eleven cards of full-bleed artwork for one shelf. A FlatList
            keeps only what is near the viewport, and a fixed card width lets it
            skip measuring. */}
        <FlatList
          data={shelf.items}
          keyExtractor={(entry) => entry.key}
          renderItem={renderCard}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.shelf}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          windowSize={3}
          removeClippedSubviews
          getItemLayout={(_, index) => ({
            length: CARD_STRIDE,
            offset: CARD_STRIDE * index,
            index,
          })}
        />
      </View>
    ),
    [renderCard]
  );

  return (
    <View style={styles.screen}>
      {/* Title and toolbar on one row. */}
      <View style={[styles.bar, { paddingTop: insets.top + Space.s }]}>
        <Text style={styles.barTitle}>Library</Text>
      </View>

      <FlatList
        data={shelves}
        keyExtractor={(shelf) => shelf.id}
        renderItem={renderShelf}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        // Shelves of artwork are more than one screen can afford to decode
        // at once.
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        windowSize={5}
        ListHeaderComponent={
          library.continuing ? (
            <ContinueCard
              entry={library.continuing}
              isPlaying={false}
              wordsPerMinute={wordsPerMinute}
              onOpen={() => openEntry(library.continuing!)}
              onTogglePlay={noop}
              onLongPress={noop}
            />
          ) : (
            <Text style={styles.intro}>
              Thirty books, ready to be read aloud. Pick one and press play — ReadingLoud
              highlights each word as it goes.
            </Text>
          )
        }
      />

      <MiniPlayer onOpen={() => {}} />
    </View>
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
});
