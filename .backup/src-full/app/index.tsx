import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useMemo } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ContinueCard } from '@/components/continue-card';
import { MiniPlayer } from '@/components/mini-player';
import { ShelfItem } from '@/components/shelf-item';
import { mark, markStart } from '@/lib/perf'; // TEMPORARY instrumentation
import { buildLibrary, type LibraryEntry, type LibraryShelf } from '@/lib/library';
import { RATE, usePrefs } from '@/speech/engine';
import { Colors, Fonts, Screen, Space } from '@/theme';

/**
 * Browse and navigate, nothing else. The logic that opened a book, stored its
 * text, tracked when it was last opened, played it aloud and imported files has
 * been removed — what remains reads the catalogue, draws the shelves, and
 * pushes to the reader.
 */
export default function LibraryScreen() {
  const router = useRouter();
  const { rate } = usePrefs();
  const insets = useSafeAreaInsets();

  // Built once, from the catalogue alone. Reading rows out of SQLite needed a
  // focus effect to run, and there are no effects left in this app — so the
  // shelves are whatever `catalog.ts` says they are, with no progress and no
  // Continue card.
  const library = useMemo(() => buildLibrary([]), []);

  /** A tap does one thing: push. No database work of any kind happens here. */
  const openEntry = useCallback(
    (entry: LibraryEntry) => {
      const target = entry.row?.id ?? entry.book?.id;
      if (target == null) return;
      markStart('tap'); // TEMPORARY instrumentation
      router.push(`/reader/${target}`);
      mark('push returned'); // TEMPORARY instrumentation
    },
    [router]
  );

  // The cards still draw their play pill and accept a long press; there is no
  // longer anything behind either.
  const noop = useCallback(() => {}, []);

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
              isPlaying={false}
              onPress={() => openEntry(entry)}
              onPlay={noop}
              onLongPress={noop}
            />
          ))}
        </ScrollView>
      </View>
    ),
    [noop, openEntry]
  );

  return (
    <View style={styles.screen}>
      {/* Title and toolbar on one row. */}
      <View style={[styles.bar, { paddingTop: insets.top + Space.s }]}>
        <Text style={styles.barTitle}>Library</Text>
        <View style={styles.headerButtons}>
          <HeaderIcon symbol="gearshape" label="Voice and text settings" onPress={() => router.push('/settings')} />
        </View>
      </View>

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
                isPlaying={false}
                wordsPerMinute={wordsPerMinute}
                onOpen={() => openEntry(library.continuing!)}
                onTogglePlay={noop}
                onLongPress={noop}
              />
            ) : (
              <Text style={styles.intro}>
                Fifty books, ready to be read aloud. Pick one and press play — ReadingLoud
                highlights each word as it goes, and remembers where you stopped.
              </Text>
            )
        }
      />

      <MiniPlayer onOpen={(id) => router.push(`/reader/${id}`)} />
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
});
