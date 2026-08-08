import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { ProgressTrack } from '@/components/progress-track';
import { progressFraction, type LibraryEntry } from '@/lib/library';
import { percentLabel, remainingLabel } from '@/lib/text';
import { coverColors, Fonts, Radius, Screen, Space } from '@/theme';

type Props = {
  entry: LibraryEntry;
  isPlaying: boolean;
  wordsPerMinute: number;
  onOpen: () => void;
  onTogglePlay: () => void;
  onLongPress: () => void;
};

/**
 * The book you are in the middle of, at full height. The cover fills the card
 * and a black gradient carries the title, the remaining time and the transport
 * — the same treatment as a shelf card, sized as the thing the screen is for.
 *
 * (This is a deliberate departure from §15's "compact card at ~120pt".)
 *
 * Height follows the cover's own 1:1.42 proportion rather than a fixed number,
 * so real artwork fills the card without odd cropping on any screen width.
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
  const height = Math.round((width - Screen.margin * 2) * CARD_ASPECT);

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
  press: { marginHorizontal: Screen.margin },
  card: {
    borderRadius: 24,
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
