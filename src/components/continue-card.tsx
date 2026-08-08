import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { ProgressTrack } from '@/components/progress-track';
import { progressFraction, type LibraryEntry } from '@/lib/library';
import { percentLabel, remainingLabel } from '@/lib/text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { coverColors, Fonts, Screen, Space } from '@/theme';

type Props = {
  entry: LibraryEntry;
  isPlaying: boolean;
  wordsPerMinute: number;
  onOpen: () => void;
  onTogglePlay: () => void;
  onLongPress: () => void;
};

/**
 * The book you are in the middle of, running the full width of the screen and
 * up behind the status bar. Nothing frames it: the artwork is the top of the
 * app, and the toolbar sits on it rather than above it.
 *
 * (A deliberate departure from §15's "compact card at ~120pt" — the reference
 * is a store shelf; this screen is one reader's own book.)
 *
 * Height follows the cover's 1:1.42 proportion, measured on the full screen
 * width, plus whatever the status bar needs.
 */
const CARD_ASPECT = 1.42;

const Ink = {
  title: 'rgba(255,255,255,0.98)',
  meta: 'rgba(255,255,255,0.72)',
} as const;

export function ContinueCard({
  entry,
  isPlaying,
  wordsPerMinute,
  onOpen,
  onTogglePlay,
  onLongPress,
}: Props) {
  const fraction = progressFraction(entry);
  const percent = percentLabel(fraction);
  const finished = entry.finished || fraction >= 1;
  const [gradientTop, gradientBottom] = coverColors(entry.title);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Full-bleed, so the aspect is taken on the whole width; the status bar's
  // height is added on top rather than eating into the artwork.
  const height = Math.round(width * CARD_ASPECT * 0.70) + insets.top;

  const meta = finished
    ? 'Finished'
    : [remainingLabel(entry.wordCount, fraction, wordsPerMinute), percent].filter(Boolean).join(' · ');

  return (
    <Pressable onPress={onOpen} onLongPress={onLongPress} style={styles.press}>
      <View style={[styles.card, { height }]}>
        {entry.cover ? (
          <Image
            source={typeof entry.cover === 'number' ? entry.cover : { uri: entry.cover }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        ) : (
          <LinearGradient
            colors={[gradientTop, gradientBottom]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}

        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.9)', 'rgba(0,0,0,0.96)']}
          locations={[0.2, 0.5, 0.78, 1]}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.content}>
          <Text numberOfLines={1} style={styles.eyebrow}>
            {isPlaying ? 'Now playing' : 'Continue'}
          </Text>

          <View style={styles.row}>
            <View style={styles.text}>
              <Text numberOfLines={2} style={styles.title}>
                {entry.title}
              </Text>
              <Text numberOfLines={1} style={styles.meta}>
                {meta}
              </Text>
            </View>

            <Pressable
              onPress={onTogglePlay}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
              style={({ pressed }) => [styles.playButton, pressed && { opacity: 0.75 }]}>
              <SymbolView
                name={isPlaying ? 'pause.fill' : 'play.fill'}
                size={24}
                tintColor="#000000"
                fallback={<Text style={styles.playFallback}>{isPlaying ? '❚❚' : '▶'}</Text>}
              />
            </Pressable>
          </View>

          <ProgressTrack fraction={fraction} height={4} style={styles.track} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: {},
  card: {
    backgroundColor: '#111',
    overflow: 'hidden',
  },
  content: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: Screen.cardPadding + 2,
    gap: Space.s,
  },
  eyebrow: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: Ink.meta,
  },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: Space.m },
  text: { flex: 1, gap: 4 },
  title: { fontFamily: Fonts.serif, fontSize: 28, lineHeight: 34, color: Ink.title },
  meta: { fontFamily: Fonts.sans, fontSize: 14, color: Ink.meta },
  track: { marginTop: Space.xs },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playFallback: { color: '#000000', fontSize: 18 },
});
