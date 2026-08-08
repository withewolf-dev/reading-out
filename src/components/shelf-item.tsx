import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ProgressTrack } from '@/components/progress-track';
import { durationLabel, progressFraction, type LibraryEntry } from '@/lib/library';
import { Colors, coverColors, Fonts, Radius, Space } from '@/theme';

type Props = {
  entry: LibraryEntry;
  isPlaying: boolean;
  onPress: () => void;
  onPlay: () => void;
  onLongPress: () => void;
};

/**
 * An episode-style card (Apple Podcasts): the cover fills the top of the card,
 * a black gradient rises from its base so the serif title reads over any
 * artwork, and below sit eyebrow, title, description, and a play pill carrying
 * the one number that matters — how long the book runs, or how much is left.
 */
const CARD_WIDTH = 264;
const IMAGE_HEIGHT = 224;

function ShelfItemView({ entry, isPlaying, onPress, onPlay, onLongPress }: Props) {
  const fraction = progressFraction(entry);
  const started = fraction > 0 && !entry.finished;
  const minutes = entry.book ? entry.book.minutes : Math.max(1, Math.round(entry.wordCount / 180));
  const pillLabel = entry.finished
    ? 'Play again'
    : started
      ? `${durationLabel(Math.max(1, Math.round(minutes * (1 - fraction))))} left`
      : durationLabel(minutes);
  const eyebrow = entry.book
    ? [entry.book.category, entry.author].filter(Boolean).join(' · ')
    : 'Your file';
  const [gradientTop, gradientBottom] = coverColors(entry.title);

  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={styles.card}>
      <View style={styles.imageWrap}>
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
        {/* The scrim that makes the title legible over any artwork. */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.14)', 'rgba(0,0,0,0.62)']}
          locations={[0.35, 0.6, 1]}
          style={StyleSheet.absoluteFill}
        />
        <Text numberOfLines={2} style={styles.imageTitle}>
          {entry.title}
        </Text>
        {started ? (
          <View style={styles.progress}>
            <ProgressTrack fraction={fraction} height={3} />
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <Text numberOfLines={1} style={styles.eyebrow}>
          {eyebrow}
        </Text>
        <Text numberOfLines={2} style={styles.title}>
          {entry.title}
        </Text>
        <Text numberOfLines={2} style={styles.description}>
          {entry.book?.description ?? entry.row?.snippet ?? ''}
        </Text>

        <View style={styles.actions}>
          <Pressable
            onPress={onPlay}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? `Pause ${entry.title}` : `Play ${entry.title}`}
            style={({ pressed }) => [styles.pill, pressed && { opacity: 0.7 }]}>
            <SymbolView
              name={isPlaying ? 'pause.fill' : 'play.fill'}
              size={12}
              tintColor={Colors.ground}
              fallback={<Text style={styles.pillIconFallback}>{isPlaying ? '❚❚' : '▶'}</Text>}
            />
            <Text style={styles.pillLabel}>{pillLabel}</Text>
          </Pressable>
          <Pressable
            onPress={onLongPress}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`More options for ${entry.title}`}>
            <SymbolView
              name="ellipsis"
              size={17}
              tintColor={Colors.inactive}
              fallback={<Text style={{ color: Colors.inactive }}>…</Text>}
            />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    borderRadius: Radius.hero,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.stroke,
    overflow: 'hidden',
  },
  imageWrap: {
    height: IMAGE_HEIGHT,
    // A dark ground behind the cover, so nothing ever flashes white under it.
    backgroundColor: '#111',
  },
  imageTitle: {
    position: 'absolute',
    left: Space.ms,
    right: Space.ms,
    bottom: Space.m,
    fontFamily: Fonts.serif,
    fontSize: 24,
    lineHeight: 30,
    color: 'rgba(255,255,255,0.97)',
  },
  progress: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  body: { padding: Space.ms, gap: 3 },
  eyebrow: { fontFamily: Fonts.sans, fontSize: 12, color: Colors.inactive },
  title: {
    fontFamily: Fonts.sans,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
    color: Colors.primary,
  },
  description: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.secondary,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Space.s,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pillLabel: { fontFamily: Fonts.sans, fontSize: 13, fontWeight: '600', color: Colors.ground },
  pillIconFallback: { color: Colors.ground, fontSize: 11 },
});

export const ShelfItem = memo(ShelfItemView);
