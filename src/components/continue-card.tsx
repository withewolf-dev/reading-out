import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ProgressTrack } from '@/components/progress-track';
import { ReadingArtwork } from '@/components/reading-artwork';
import { progressFraction, type ReadingRow } from '@/db';
import { percentLabel, remainingLabel } from '@/lib/text';
import { Colors, CoverWidth, Fonts, Radius, Screen, Space, Track } from '@/theme';

type Props = {
  reading: ReadingRow;
  isPlaying: boolean;
  wordsPerMinute: number;
  onOpen: () => void;
  onTogglePlay: () => void;
  onLongPress: () => void;
};

/** Compact "Continue" card, ~120pt — the hero earns its place by being small (§15). */
export function ContinueCard({
  reading,
  isPlaying,
  wordsPerMinute,
  onOpen,
  onTogglePlay,
  onLongPress,
}: Props) {
  const fraction = progressFraction(reading);
  const percent = percentLabel(fraction);
  const finished = reading.finished_at != null || fraction >= 1;

  return (
    <Pressable onPress={onOpen} onLongPress={onLongPress} style={styles.press}>
      <LinearGradient
        colors={[Colors.cardTop, Colors.cardBottom]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.card}>
        <ReadingArtwork
          title={reading.title}
          coverPath={reading.cover_path}
          width={CoverWidth.hero}
          radius={Radius.thumb}
        />
        <View style={styles.body}>
          <Text numberOfLines={2} style={styles.title}>
            {reading.title}
          </Text>
          <Text numberOfLines={1} style={styles.meta}>
            {finished
              ? 'Finished'
              : [remainingLabel(reading.word_count, fraction, wordsPerMinute), percent]
                  .filter(Boolean)
                  .join(' · ')}
          </Text>
          <ProgressTrack fraction={fraction} height={Track.resume} style={styles.track} />
        </View>
        <Pressable
          onPress={onTogglePlay}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
          style={styles.playButton}>
          <SymbolView
            name={isPlaying ? 'pause.fill' : 'play.fill'}
            size={20}
            tintColor={Colors.ground}
            fallback={<Text style={styles.playFallback}>{isPlaying ? '❚❚' : '▶'}</Text>}
          />
        </Pressable>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: { marginHorizontal: Screen.margin },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.ms,
    padding: Screen.cardPadding,
    borderRadius: Radius.hero,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.stroke,
  },
  body: { flex: 1, gap: 6 },
  title: { fontFamily: Fonts.sans, fontSize: 17, fontWeight: '600', color: Colors.primary },
  meta: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.inactive },
  track: { marginTop: 2 },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playFallback: { color: Colors.ground, fontSize: 16 },
});
