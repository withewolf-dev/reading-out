import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ReaderView } from '../../../modules/speech-engine/src/ReaderView';
import { ProgressTrack } from '@/components/progress-track';
import { ReadingArtwork } from '@/components/reading-artwork';
import { getReading, getReadingText, putSetting, touchOpened, type ReadingRow } from '@/db';
import { catalogBook, type CatalogBook } from '@/lib/catalog';
import { loadCoverUri } from '@/lib/library';
import { player, prefs, RATE, usePlayer, usePrefs } from '@/speech/engine';
import { Colors, coverHue, Fonts, Radius, Screen, Space, tintedSurface, Track } from '@/theme';

/** Multipliers on AVFoundation's default rate, shown as the familiar ×. */
const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];

export default function ReaderScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const readingId = Number(params.id);
  const db = useSQLiteContext();
  const router = useRouter();
  const state = usePlayer();
  const { fontSize, rate } = usePrefs();

  const [reading, setReading] = useState<ReadingRow | null>(null);
  const [book, setBook] = useState<CatalogBook | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [tint, setTint] = useState({ hue: 210, saturation: 0.1 });
  const insets = useSafeAreaInsets();

  useEffect(() => {
    let cancelled = false;
    Promise.all([getReading(db, readingId), getReadingText(db, readingId)]).then(([row, body]) => {
      if (cancelled) return;
      setReading(row ?? null);
      setText(body);
      // A bundled book keeps its cover in the app bundle rather than in the
      // row; the native reader tints the page from the file, so resolve it.
      const entry = catalogBook(row?.catalog_id);
      setBook(entry);
      if (entry) loadCoverUri(entry).then((uri) => !cancelled && setCoverUri(uri));
      else setCoverUri(row?.cover_path ?? null);
    });
    touchOpened(db, readingId).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [db, readingId]);

  /**
   * Where this reading starts when nothing has been played yet: the first
   * chapter of a bundled book, past its title page and contents list.
   */
  const openingOffset =
    (reading?.progress_offset ?? 0) > 0 ? reading!.progress_offset : (book?.bodyOffset ?? 0);

  const isCurrent = state.readingId === readingId;
  const playing = isCurrent && state.status === 'speaking';

  /** Tapped a paragraph in the native view. */
  const startAt = useCallback(
    (offset: number) => {
      if (!reading || text == null) return;
      if (player.isLoaded(readingId)) {
        player.seek(offset);
        if (!playing) player.resume();
      } else {
        player.play({ id: readingId, title: reading.title, text }, offset);
      }
    },
    [playing, reading, readingId, text]
  );

  const togglePlay = useCallback(() => {
    if (!reading || text == null) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (player.isLoaded(readingId)) player.toggle();
    else {
      const finished = reading.finished_at != null;
      player.play(
        { id: readingId, title: reading.title, text },
        finished ? (book?.bodyOffset ?? 0) : openingOffset
      );
    }
  }, [book, openingOffset, reading, readingId, text]);

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

  // While this reading is playing the engine's position is the truth; otherwise
  // fall back to what was persisted.
  const offset = isCurrent ? state.offset : (reading?.progress_offset ?? 0);
  const total = reading?.char_count ?? 0;
  const fraction = total > 0 ? Math.min(1, offset / total) : 0;
  // ~18 UTF-16 units/sec at 1× (§19.1) — elapsed and remaining as clock time,
  // the way the reference labels its scrubber.
  const unitsPerSecond = 18 * multiplier;
  const elapsedSeconds = offset / unitsPerSecond;
  const remainingSeconds = Math.max(0, (total - offset) / unitsPerSecond);

  // The page, the nav bar and the dock are one continuous field of the cover's
  // colour — Apple Podcasts floods the whole screen rather than framing it (§15).
  const pageTop = tintedSurface(tint.hue, tint.saturation, 0.99);

  return (
    <View style={[styles.screen, { backgroundColor: pageTop }]}>
      <Stack.Screen
        options={{
          // Nothing at all across the top: no blur, no material, no scroll edge
          // effect. Any of them draws a band with a visible seam against the
          // tinted page. The text's own fade does this job.
          title: '',
          headerTransparent: true,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: 'transparent' },
          scrollEdgeEffects: { top: 'hidden', bottom: 'automatic', left: 'automatic', right: 'automatic' },
        }}
      />

      {text != null ? (
        <ReaderView
          style={styles.reader}
          text={text}
          fontSize={fontSize}
          active={isCurrent}
          startOffset={openingOffset}
          hue={coverHue(reading?.title ?? '')}
          coverPath={coverUri}
          onSeek={(event) => startAt(event.nativeEvent.offset)}
          onTint={(event) => setTint(event.nativeEvent)}
        />
      ) : null}

      {/* Artwork, title and source sit over the page, with the text dissolving
          underneath — Apple's transcript header (§15). */}
      <View style={[styles.header, { paddingTop: insets.top + 60 }]} pointerEvents="none">
        <ReadingArtwork
          title={reading?.title ?? ''}
          coverPath={book?.cover ?? reading?.cover_path}
          width={54}
          radius={Radius.thumbSmall}
        />
        <View style={styles.headerText}>
          <Text numberOfLines={2} style={styles.headerTitle}>
            {reading?.title ?? ''}
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
          <ControlButton symbol="waveform" size={26} label="Voice and text" onPress={() => router.push('/settings')} />
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
