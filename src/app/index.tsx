import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ContinueCard } from '@/components/continue-card';
import { ImportCard } from '@/components/import-card';
import { MiniPlayer } from '@/components/mini-player';
import { CARD_WIDTH, ShelfItem } from '@/components/shelf-item';
import { importBook as runImport, type ImportStage } from '@/lib/import';
import { buildLibrary, type LibraryEntry, type LibraryShelf } from '@/lib/library';
import { insertImport, listReadings, touchOpened, type ReadingRow } from '@/db';
import { RATE, usePrefs } from '@/speech/engine';
import { Colors, Fonts, Screen, Space } from '@/theme';

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
  const db = useSQLiteContext();
  const router = useRouter();
  const { rate } = usePrefs();
  const insets = useSafeAreaInsets();

  const [readings, setReadings] = useState<ReadingRow[]>([]);

  const reload = useCallback(() => {
    listReadings(db).then(setReadings).catch(() => setReadings([]));
  }, [db]);

  // Re-read on focus so progress made in the reader shows on the way back.
  useFocusEffect(reload);

  const library = useMemo(() => buildLibrary(readings), [readings]);

  // The invitation is for people who have not accepted it. Once a book of their
  // own is on the shelf the card has made its point, and the + in the toolbar
  // carries importing from then on.
  const hasImported = useMemo(() => readings.some((row) => row.catalog_id == null), [readings]);

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
      const row = entry.row;
      if (row) {
        // Already a reading: the row id is the only thing the reader needs.
        touchOpened(db, row.id).catch(() => {});
        router.push({ pathname: '/reader/[id]', params: { id: String(row.id) } });
      } else if (book) {
        // Never opened. A catalogue id in place of a row id; the reader makes
        // the row when it gets there.
        router.push({ pathname: '/reader/[id]', params: { id: book.id } });
      }
    },
    [db, router]
  );

  // The cards still draw their play pill and take a long press; nothing is
  // behind either while playback lives on the reader.
  const noop = useCallback(() => {}, []);

  const [stage, setStage] = useState<ImportStage | null>(null);

  const importBook = useCallback(async () => {
    try {
      const imported = await runImport(setStage);
      if (!imported) return; // dismissed the picker
      const rowId = await insertImport(db, imported);
      reload();
      router.push({
        pathname: '/reader/[id]',
        params: {
          id: String(rowId),
          staged: imported.id,
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
  }, [db, reload, router]);

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

  const hero = library.continuing;

  // How far the hero has to leave before the bar behind the toolbar arrives.
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  const fadeIn = hero ? 220 : 0;

  // The blurred bar, absent over the artwork and solid once past it.
  const barBackground = useAnimatedStyle(() => ({
    opacity: hero ? interpolate(scrollY.value, [fadeIn - 60, fadeIn], [0, 1], 'clamp') : 1,
  }));
  // The two sets of glyphs cross-fade, so neither is ever unreadable.
  const onArtwork = useAnimatedStyle(() => ({
    opacity: hero ? interpolate(scrollY.value, [fadeIn - 60, fadeIn], [1, 0], 'clamp') : 0,
  }));
  const onPaper = useAnimatedStyle(() => ({
    opacity: hero ? interpolate(scrollY.value, [fadeIn - 60, fadeIn], [0, 1], 'clamp') : 1,
  }));

  const toolbar = (tint: string) => (
    <View style={styles.barRow}>
      <Text style={[styles.barTitle, tint === '#FFFFFF' && styles.barTitleOnArtwork, { color: tint }]}>
        Library
      </Text>
      <View style={styles.headerButtons}>
        <HeaderIcon symbol="plus" label="Import a book" onPress={importBook} tint={tint} />
        <HeaderIcon
          symbol="gearshape"
          label="Voice and text settings"
          onPress={() => router.push('/settings')}
          tint={tint}
        />
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      {/* The hero runs under the status bar, so its glyphs have to invert. */}
      <StatusBar style={hero ? 'light' : 'dark'} />

      <Animated.FlatList
        onScroll={onScroll}
        scrollEventThrottle={16}
        data={shelves}
        keyExtractor={(shelf) => shelf.id}
        renderItem={renderShelf}
        contentContainerStyle={hero ? styles.contentFlush : styles.content}
        showsVerticalScrollIndicator={false}
        // Shelves of artwork are more than one screen can afford to decode
        // at once.
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        windowSize={5}
        ListHeaderComponent={
          <>
            {hero ? (
              <ContinueCard
                entry={hero}
                isPlaying={false}
                wordsPerMinute={wordsPerMinute}
                onOpen={() => openEntry(hero)}
                onTogglePlay={noop}
                onLongPress={noop}
              />
            ) : null}
            {hasImported ? null : <ImportCard onImport={importBook} />}
          </>
        }
      />

      {/* Pinned above the list: nothing but glyphs while the artwork is behind
          it, a blurred bar once the hero has gone. */}
      <View style={styles.barPinned} pointerEvents="box-none">
        <Animated.View style={[StyleSheet.absoluteFill, barBackground]} pointerEvents="none">
          <BlurView intensity={70} tint="light" style={StyleSheet.absoluteFill} />
          <View style={styles.barHairline} />
        </Animated.View>

        {hero ? (
          // A short scrim so the clock and battery read over any cover.
          <LinearGradient
            colors={['rgba(0,0,0,0.38)', 'rgba(0,0,0,0)']}
            style={[StyleSheet.absoluteFill, { bottom: undefined, height: insets.top + Space.s }]}
            pointerEvents="none"
          />
        ) : null}

        {/* Two rows stacked in the same box, cross-fading. The dark set lays
            the box out; the white set is pinned on top of it, so both share one
            set of insets and neither can drift. */}
        <View style={{ paddingTop: insets.top + Space.s }}>
          <Animated.View style={onPaper} pointerEvents="box-none">
            {toolbar(Colors.accent)}
          </Animated.View>
          <Animated.View
            style={[StyleSheet.absoluteFill, { top: insets.top + Space.s }, onArtwork]}
            pointerEvents="box-none">
            {toolbar('#FFFFFF')}
          </Animated.View>
        </View>
      </View>

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
  tint = Colors.accent,
}: {
  symbol: string;
  label: string;
  onPress: () => void;
  tint?: string;
}) {
  return (
    <Pressable hitSlop={10} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <SymbolView
        name={symbol as never}
        size={20}
        tintColor={tint}
        fallback={<Text style={{ color: tint }}>{label}</Text>}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.ground },
  barPinned: { position: 'absolute', left: 0, right: 0, top: 0, zIndex: 10 },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Screen.margin,
    paddingBottom: Space.ms,
  },
  barHairline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.stroke,
  },
  barTitle: {
    fontFamily: Fonts.sans,
    fontSize: 34,
    fontWeight: '700',
    color: Colors.primary,
    // Without this the 34pt title overflows its box to the left when the row
    // has to make room for two icons.
    flexShrink: 1,
  },
  barTitleOnArtwork: {
    color: '#FFFFFF',
    // Artwork is unpredictable behind large type; a soft shadow keeps the
    // title legible over a pale cover without a scrim.
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowRadius: 12,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    // Roomy: iOS 26 wraps these in a glass pill, and tight icons look cramped
    // against their own capsule.
    gap: 30,
    paddingHorizontal: 6,
  },
  content: { paddingTop: 108, paddingBottom: 120 },
  // The hero runs to the top of the screen, so nothing is inset above it.
  contentFlush: { paddingBottom: 120 },
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
