import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BookCover } from '@/components/book-cover';
import { ProgressTrack } from '@/components/progress-track';
import { durationLabel, progressFraction, type LibraryEntry } from '@/lib/library';
import { Space } from '@/theme';

type Props = {
  entry: LibraryEntry;
  isPlaying: boolean;
  onPress: () => void;
  onPlay: () => void;
  onLongPress: () => void;
};

export const CARD_WIDTH = 240;

/**
 * The cover *is* the card, and the card is a book: spine, page edge and shadow
 * around artwork that fills it, with the text laid over the foot.
 *
 * Everything below the gradient is white on dark by construction, so it
 * deliberately ignores the app's ink scale — the surface is artwork, not a
 * themed background.
 */
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

  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={styles.card}>
      <BookCover title={entry.title} coverPath={entry.cover} width={CARD_WIDTH}>
        {/* Reaches full black well before the text starts, so a pale cover
            cannot wash out the title. */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.92)', 'rgba(0,0,0,0.96)']}
          locations={[0.18, 0.46, 0.72, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
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
      </BookCover>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: CARD_WIDTH },
  content: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: Space.ms,
    gap: 3,
  },
  eyebrow: { fontSize: 12, color: Ink.eyebrow },
  title: { fontFamily: 'ui-serif', fontSize: 21, lineHeight: 26, color: Ink.title },
  description: { fontSize: 13, lineHeight: 18, color: Ink.body },
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
  pillLabel: { fontSize: 13, fontWeight: '600', color: '#000000' },
  pillIconFallback: { color: '#000000', fontSize: 11 },
  progress: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});

export const ShelfItem = memo(ShelfItemView);
