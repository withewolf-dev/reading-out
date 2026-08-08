import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ProgressTrack } from '@/components/progress-track';
import { durationLabel, progressFraction, type LibraryEntry } from '@/lib/library';
import { coverColors, Fonts, Radius, Space } from '@/theme';

type Props = {
  entry: LibraryEntry;
  isPlaying: boolean;
  onPress: () => void;
  onPlay: () => void;
  onLongPress: () => void;
};

/**
 * The cover *is* the card. Artwork fills the whole tile and a black gradient
 * rises from its base to carry the eyebrow, title, description and play pill —
 * no separate body panel underneath.
 *
 * Everything here is white on dark by construction, so it deliberately ignores
 * the app's ink scale: the surface is artwork, not a themed background.
 */
export const CARD_WIDTH = 264;
const CARD_HEIGHT = 372;

const Ink = {
  title: 'rgba(255,255,255,0.98)',
  body: 'rgba(255,255,255,0.76)',
  eyebrow: 'rgba(255,255,255,0.62)',
} as const;

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
  const description = entry.book?.description ?? entry.row?.snippet ?? '';
  const [gradientTop, gradientBottom] = coverColors(entry.title);

  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={styles.card}>
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

      {/* Reaches full black well before the text starts, so a pale cover can't
          wash out the title. */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.92)', 'rgba(0,0,0,0.96)']}
        locations={[0.18, 0.46, 0.72, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.content}>
        <Text numberOfLines={1} style={styles.eyebrow}>
          {eyebrow}
        </Text>
        <Text numberOfLines={2} style={styles.title}>
          {entry.title}
        </Text>
        {description ? (
          <Text numberOfLines={2} style={styles.description}>
            {description}
          </Text>
        ) : null}

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
              tintColor="#000000"
              fallback={<Text style={styles.pillIconFallback}>{isPlaying ? '❚❚' : '▶'}</Text>}
            />
            <Text style={styles.pillLabel}>{pillLabel}</Text>
          </Pressable>
          <Pressable
            onPress={onLongPress}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={`More options for ${entry.title}`}>
            <SymbolView
              name="ellipsis"
              size={17}
              tintColor={Ink.eyebrow}
              fallback={<Text style={{ color: Ink.eyebrow }}>…</Text>}
            />
          </Pressable>
        </View>
      </View>

      {started ? (
        <View style={styles.progress}>
          <ProgressTrack fraction={fraction} height={3} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: Radius.hero,
    // Nothing flashes white while the artwork decodes.
    backgroundColor: '#111',
    overflow: 'hidden',
  },
  content: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: Space.ms,
    gap: 3,
  },
  eyebrow: { fontFamily: Fonts.sans, fontSize: 12, color: Ink.eyebrow },
  title: {
    fontFamily: Fonts.serif,
    fontSize: 22,
    lineHeight: 27,
    color: Ink.title,
  },
  description: { fontFamily: Fonts.sans, fontSize: 13, lineHeight: 18, color: Ink.body },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Space.m,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pillLabel: { fontFamily: Fonts.sans, fontSize: 13, fontWeight: '600', color: '#000000' },
  pillIconFallback: { color: '#000000', fontSize: 11 },
  progress: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});

export const ShelfItem = memo(ShelfItemView);
