import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ContinueCard } from '@/components/continue-card';
import { ImportCard } from '@/components/import-card';
import { MiniPlayer } from '@/components/mini-player';
import { CARD_WIDTH, ShelfItem } from '@/components/shelf-item';
import {
  importBook as runImport,
  listImports,
  type ImportedBook,
  type ImportStage,
} from '@/lib/import';
import { buildLibrary, type LibraryEntry, type LibraryShelf } from '@/lib/library';
import type { ReadingRow } from '@/db';
import { RATE, usePrefs } from '@/speech/engine';
import { Colors, Fonts, Screen, Space } from '@/theme';

/**
 * An imported book, shaped like a database row so `buildLibrary` can shelve it
 * beside the bundled ones. Ids start well above the catalogue so they cannot
 * collide with the position-based ids the player uses.
 */
function asRow(book: ImportedBook, index: number): ReadingRow {
  return {
    id: 10_000 + index,
    title: book.title,
    cover_path: book.coverPath,
    progress_offset: 0,
    char_count: book.charCount,
    word_count: Math.round(book.charCount / 5.5),
    snippet: '',
    created_at: book.importedAt,
    last_opened_at: null,
    finished_at: null,
    catalog_id: null,
  };
}

const STAGE_LABEL: Record<ImportStage, string> = {
  picking: 'Choosing a file…',
  reading: 'Reading the file…',
  saving: 'Almost there…',
};

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

  const [imports, setImports] = useState<ImportedBook[]>([]);
  useEffect(() => {
    listImports().then(setImports).catch(() => setImports([]));
  }, []);

  const library = useMemo(() => buildLibrary(imports.map(asRow)), [imports]);

  // Three catalogue shelves. "Your files" is not one of them — whatever the
  // reader brought themselves always shows, and always first.
  const shelves = useMemo(() => {
    const all = library.shelves;
    const mine = all[0]?.id === 'imports' ? 1 : 0;
    return all.slice(0, mine + 3);
  }, [library]);

  /** A tap pushes, and hands over the artwork, title and text asset with it. */
  const openEntry = useCallback(
    (entry: LibraryEntry) => {
      const book = entry.book;
      if (book) {
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
      } else {
        // Imported: matched by title, since the synthetic row carries no id of
        // its own that survives the trip through buildLibrary.
        const mine = imports.find((b) => b.title === entry.title);
        if (!mine) return;
        router.push({
          pathname: '/reader/[id]',
          params: {
            id: mine.id,
            title: mine.title,
            textUri: mine.textUri,
            coverUri: mine.coverPath ?? '',
          },
        });
      }
    },
    [imports, router]
  );

  // The cards still draw their play pill and take a long press; nothing is
  // behind either while playback lives on the reader.
  const noop = useCallback(() => {}, []);

  const [stage, setStage] = useState<ImportStage | null>(null);

  const importBook = useCallback(async () => {
    try {
      const imported = await runImport(setStage);
      if (!imported) return; // dismissed the picker
      setImports((current) => [imported, ...current.filter((b) => b.id !== imported.id)]);
      router.push({
        pathname: '/reader/[id]',
        params: {
          id: imported.id,
          title: imported.title,
          textUri: imported.textUri,
          coverUri: imported.coverPath ?? '',
        },
      });
    } catch (error) {
      Alert.alert(
        "That file can't be read",
        error instanceof Error ? error.message : 'Something went wrong opening it.'
      );
    } finally {
      setStage(null);
    }
  }, [router]);

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
        <View style={styles.headerButtons}>
          <HeaderIcon symbol="plus" label="Import a book" onPress={importBook} />
          <HeaderIcon
            symbol="gearshape"
            label="Voice and text settings"
            onPress={() => router.push('/settings')}
          />
        </View>
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
          <>
            <ImportCard onImport={importBook} />
            {library.continuing ? (
              <ContinueCard
                entry={library.continuing}
                isPlaying={false}
                wordsPerMinute={wordsPerMinute}
                onOpen={() => openEntry(library.continuing!)}
                onTogglePlay={noop}
                onLongPress={noop}
              />
            ) : null}
          </>
        }
      />

      <MiniPlayer onOpen={() => {}} />

      {/* Extraction runs on a background thread, so this stays responsive and
          the label says which step is running. There is no percentage: the
          native call does not publish progress, and a bar filling on a timer
          would be a lie about work that has not happened. */}
      {stage != null && stage !== 'picking' ? (
        <View style={styles.busy}>
          <View style={styles.busyPanel}>
            <ActivityIndicator color={Colors.primary} />
            <Text style={styles.busyText}>{STAGE_LABEL[stage]}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function HeaderIcon({
  symbol,
  label,
  onPress,
}: {
  symbol: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable hitSlop={10} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <SymbolView
        name={symbol as never}
        size={20}
        tintColor={Colors.accent}
        fallback={<Text style={{ color: Colors.accent }}>{label}</Text>}
      />
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
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    // Roomy: iOS 26 wraps these in a glass pill, and tight icons look cramped
    // against their own capsule.
    gap: 30,
    paddingHorizontal: 6,
  },
  content: { paddingTop: Space.s, paddingBottom: 120 },
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
  busy: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  busyPanel: {
    alignItems: 'center',
    gap: Space.m,
    backgroundColor: Colors.ground,
    paddingHorizontal: Space.xl + Space.m,
    paddingVertical: Space.xl,
    borderRadius: 16,
  },
  busyText: { fontFamily: Fonts.sans, fontSize: 15, color: Colors.primary },
  shelf: { paddingHorizontal: Screen.margin, paddingTop: Space.m, gap: Space.l },
});
