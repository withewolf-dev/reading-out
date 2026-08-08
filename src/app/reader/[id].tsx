import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ReaderView } from '../../../modules/speech-engine/src/ReaderView';
import { BookCover } from '@/components/book-cover';
import { ProgressTrack } from '@/components/progress-track';
import { ReadingArtwork } from '@/components/reading-artwork';
import { putSetting } from '@/db';
import { CATALOG, catalogBook } from '@/lib/catalog';
import { takeStagedText } from '@/lib/import';
import { player, prefs, RATE, usePlayer, usePrefs } from '@/speech/engine';
import { Colors, coverHue, Fonts, Radius, Screen, Space, tintedSurface } from '@/theme';

/** Multipliers on AVFoundation's default rate, shown as the familiar ×. */
const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];

/**
 * The reader, back in full: artwork header, tinted page, transcript controls.
 *
 * What changed while it was away is where the book comes from. It used to read
 * the text out of SQLite, which meant inserting the whole book on a first open;
 * it now reads the bundled asset directly — measured at 51 ms for Moby-Dick's
 * 1.2 MB — so nothing is copied and nothing is stored.
 */
export default function ReaderScreen() {
  const params = useLocalSearchParams<{
    id: string;
    title?: string;
    cover?: string;
    text?: string;
    bodyOffset?: string;
    /** file:// path to an imported book's text; absent for bundled ones. */
    textUri?: string;
    coverUri?: string;
  }>();

  const db = useSQLiteContext();
  const router = useRouter();
  const state = usePlayer();
  const { fontSize, rate } = usePrefs();
  const insets = useSafeAreaInsets();

  // Everything the opening frame needs rides in on the route; the catalogue is
  // only consulted for what does not (author, char count).
  const book = catalogBook(params.id);
  const title = params.title ?? book?.title ?? '';
  const cover = params.cover ? Number(params.cover) : (book?.cover ?? null);
  const textAsset = params.text ? Number(params.text) : (book?.text ?? null);
  const bodyOffset = params.bodyOffset ? Number(params.bodyOffset) : (book?.bodyOffset ?? 0);

  // The engine is keyed by number. With no rows any more, a book's position in
  // the catalogue is the stable id — good for a session, not across launches.
  // Bundled books key off catalogue position; an import has none, so it gets a
  // slot above the catalogue instead.
  const readingId =
    book != null ? CATALOG.indexOf(book) + 1 : CATALOG.length + 1;

  const [text, setText] = useState<string | null>(null);
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [tint, setTint] = useState({ hue: 210, saturation: 0.1 });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // A book imported a moment ago is already in memory: the extractor handed
    // back the whole text, so opening it costs nothing at all. Writing it out
    // and reading it straight back would be the same wasted round trip that
    // made opening a bundled book slow.
    const stagedText = params.textUri ? takeStagedText(params.id) : null;
    if (stagedText != null) {
      if (params.coverUri) setCoverUri(params.coverUri);
      setText(stagedText);
      return;
    }

    (async () => {
      try {
        if (params.coverUri) {
          if (!cancelled) setCoverUri(params.coverUri);
        } else if (cover != null && Number.isFinite(cover)) {
          const art = Asset.fromModule(cover);
          if (!art.localUri) await art.downloadAsync();
          if (!cancelled) setCoverUri(art.localUri ?? art.uri);
        }

        // An imported book lives on disk; a bundled one is a Metro asset.
        let uri = params.textUri ?? null;
        if (uri == null) {
          if (textAsset == null || !Number.isFinite(textAsset)) return;
          const asset = Asset.fromModule(textAsset);
          if (!asset.localUri) await asset.downloadAsync();
          uri = asset.localUri ?? asset.uri;
        }

        const body = await new File(uri).text();
        if (cancelled) return;

        setText(body);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cover, params.coverUri, params.id, params.textUri, textAsset]);

  const isCurrent = state.readingId === readingId;
  const playing = isCurrent && state.status === 'speaking';

  /** Tapped a paragraph in the native view. */
  const startAt = useCallback(
    (offset: number) => {
      if (text == null) return;
      if (player.isLoaded(readingId)) {
        player.seek(offset);
        if (!playing) player.resume();
      } else {
        player.play({ id: readingId, title, text }, offset);
      }
    },
    [playing, readingId, text, title]
  );

  const togglePlay = useCallback(() => {
    if (text == null) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (player.isLoaded(readingId)) player.toggle();
    else player.play({ id: readingId, title, text }, bodyOffset);
  }, [bodyOffset, readingId, text, title]);

  const cycleSpeed = useCallback(() => {
    const current = Math.round((rate / RATE.default) * 100) / 100;
    const index = SPEEDS.findIndex((speed) => Math.abs(speed - current) < 0.01);
    const next = SPEEDS[(index + 1) % SPEEDS.length];
    const value = Math.min(RATE.max, Math.max(RATE.min, next * RATE.default));
    prefs.set({ rate: value });
    putSetting(db, 'rate', String(value)).catch(() => {});
  }, [db, rate]);

  const speedLabel = `${Math.round((rate / RATE.default) * 100) / 100}×`;
  const multiplier = rate / RATE.default;

  // Nothing is persisted any more, so position comes from the engine alone.
  const offset = isCurrent ? state.offset : 0;
  const total = book?.charCount ?? text?.length ?? 0;
  const fraction = total > 0 ? Math.min(1, offset / total) : 0;
  // ~18 UTF-16 units/sec at 1× (§19.1) — elapsed and remaining as clock time.
  const unitsPerSecond = 18 * multiplier;
  const elapsedSeconds = offset / unitsPerSecond;
  const remainingSeconds = Math.max(0, (total - offset) / unitsPerSecond);

  // The page, the nav bar and the dock are one continuous field of the cover's
  // colour — Apple Podcasts floods the whole screen rather than framing it (§15).
  const pageTop = tintedSurface(tint.hue, tint.saturation, 0.99);

  // Cover and title, with the loader, until the book lands.
  if (text == null) {
    return (
      <View style={[styles.screen, { backgroundColor: pageTop }]}>
        <View style={styles.opening}>
          <BookCover title={title} coverPath={params.coverUri ?? cover} width={200} />
          <Text style={styles.openingTitle}>{title}</Text>
        </View>
        <View style={styles.openingFooter}>
          {failed ? (
            <Text style={styles.loading}>This book could not be opened.</Text>
          ) : (
            <>
              <ActivityIndicator color={Colors.inactive} />
              <Text style={styles.loading}>Loading the book…</Text>
            </>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: pageTop }]}>
      <ReaderView
        style={styles.reader}
        text={text}
        fontSize={fontSize}
        active={isCurrent}
        startOffset={bodyOffset}
        hue={coverHue(title)}
        coverPath={coverUri}
        onSeek={(event) => startAt(event.nativeEvent.offset)}
        onTint={(event) => setTint(event.nativeEvent)}
      />

      {/* Artwork, title and source sit over the page, with the text dissolving
          underneath — Apple's transcript header (§15). */}
      <View style={[styles.header, { paddingTop: insets.top + 60 }]} pointerEvents="none">
        <ReadingArtwork
          title={title}
          coverPath={params.coverUri ?? cover}
          width={54}
          radius={Radius.thumbSmall}
        />
        <View style={styles.headerText}>
          <Text numberOfLines={2} style={styles.headerTitle}>
            {title}
          </Text>
          {book ? (
            <Text numberOfLines={1} style={styles.headerAuthor}>
              {book.author}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Apple Podcasts' transcript controls: everything sits directly on the
          tinted page — no panel, no glass, no border (§15). */}
      <View style={styles.dock}>
        <ProgressTrack fraction={fraction} height={4} />
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>{clockLabel(elapsedSeconds)}</Text>
          <Text style={styles.progressLabel}>−{clockLabel(remainingSeconds)}</Text>
        </View>

        <View style={styles.controlRow}>
          <Pressable onPress={cycleSpeed} hitSlop={12} accessibilityRole="button" accessibilityLabel={`Speed ${speedLabel}`}>
            <Text style={styles.speed}>{speedLabel}</Text>
          </Pressable>
          <ControlButton symbol="gobackward.15" size={34} label="Back 15 seconds" onPress={() => player.skip(-15)} />
          <Pressable
            onPress={togglePlay}
            hitSlop={16}
            accessibilityRole="button"
            accessibilityLabel={playing ? 'Pause' : 'Play'}>
            <SymbolView
              name={playing ? 'pause.fill' : 'play.fill'}
              size={46}
              tintColor={Colors.primary}
              fallback={<Text style={styles.fallback}>{playing ? '❚❚' : '▶'}</Text>}
            />
          </Pressable>
          <ControlButton symbol="goforward.30" size={34} label="Forward 30 seconds" onPress={() => player.skip(30)} />
          <ControlButton
            symbol="waveform"
            size={26}
            label="Voice and text"
            onPress={() => router.push('/settings')}
          />
        </View>
      </View>
    </View>
  );
}

/** "8:17", "27:58", "21:04:11" — elapsed/remaining in clock form. */
function clockLabel(totalSeconds: number): string {
  const whole = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = whole % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}

function ControlButton({
  symbol,
  label,
  onPress,
  size = 22,
}: {
  symbol: string;
  label: string;
  onPress: () => void;
  size?: number;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={12} accessibilityRole="button" accessibilityLabel={label}>
      <SymbolView
        name={symbol as never}
        size={size}
        tintColor={Colors.secondary}
        fallback={<Text style={styles.fallback}>{label}</Text>}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.ground },
  reader: { flex: 1 },
  opening: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  openingTitle: {
    marginTop: 28,
    fontFamily: Fonts.sans,
    fontSize: 22,
    fontWeight: '600',
    color: Colors.primary,
    textAlign: 'center',
  },
  openingFooter: { alignItems: 'center', gap: 10, paddingBottom: 56 },
  loading: { fontFamily: Fonts.sans, fontSize: 14, color: Colors.inactive },
  header: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
    paddingHorizontal: Screen.margin,
    paddingBottom: Space.m,
    zIndex: 5,
  },
  // Keeps the column narrow enough that a book title breaks across two lines
  // instead of running the full width of the screen.
  headerText: { flex: 1, paddingRight: Space.xl, gap: 2 },
  headerTitle: {
    fontFamily: Fonts.sans,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 25,
    color: Colors.primary,
  },
  headerAuthor: { fontFamily: Fonts.sans, fontSize: 14, color: Colors.inactive },
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: Space.s,
    paddingHorizontal: Screen.margin + Space.xs,
    paddingBottom: 44,
    zIndex: 10,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 28,
  },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontFamily: Fonts.sans, fontSize: 14, color: Colors.inactive },
  speed: { fontFamily: Fonts.sans, fontSize: 17, color: Colors.secondary, minWidth: 42, textAlign: 'center' },
  fallback: { color: Colors.secondary, fontSize: 13 },
});
