import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassPanel } from '@/components/glass-panel';
import { ProgressTrack } from '@/components/progress-track';
import { ReadingArtwork } from '@/components/reading-artwork';
import { percentLabel, remainingLabel } from '@/lib/text';
import { player, RATE, usePlayer, usePrefs } from '@/speech/engine';
import { Colors, CoverWidth, Fonts, Radius, Screen, Space, Track } from '@/theme';

type Props = {
  onOpen: (readingId: number) => void;
  /** A file URI for an imported document, or a Metro asset handle for a bundled book. */
  coverPath?: string | number | null;
  /** Derived at import, never recomputed from the text here (§17.9). */
  wordCount?: number;
};

/** Persistent overlay above the Library content — never a tab. */
export function MiniPlayer({ onOpen, coverPath, wordCount = 0 }: Props) {
  const state = usePlayer();
  const { rate } = usePrefs();
  const insets = useSafeAreaInsets();
  if (state.readingId == null) return null;

  const fraction = state.charCount > 0 ? state.offset / state.charCount : 0;
  const playing = state.status === 'speaking';
  const wordsPerMinute = 180 * (rate / RATE.default);

  return (
    <Pressable
      onPress={() => onOpen(state.readingId!)}
      style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, Space.m) }]}
      accessibilityRole="button"
      accessibilityLabel={`Open ${state.title}`}>
      <GlassPanel style={styles.bar}>
        <ReadingArtwork
          title={state.title}
          coverPath={coverPath}
          width={CoverWidth.mini}
          radius={Radius.thumbSmall}
        />
        <View style={styles.body}>
          <Text numberOfLines={1} style={styles.title}>
            {state.title}
          </Text>
          {/* "3hrs 43min left · 1% complete" — remaining and percent in one line (§15) */}
          <Text numberOfLines={1} style={styles.meta}>
            {[remainingLabel(wordCount, fraction, wordsPerMinute), percentLabel(fraction)]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          <ProgressTrack fraction={fraction} height={Track.mini} />
        </View>
        <Pressable
          hitSlop={14}
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Pause' : 'Play'}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            player.toggle();
          }}>
          <SymbolView
            name={playing ? 'pause.fill' : 'play.fill'}
            size={22}
            tintColor={Colors.primary}
            fallback={<Text style={styles.fallback}>{playing ? '❚❚' : '▶'}</Text>}
          />
        </Pressable>
      </GlassPanel>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: Screen.margin },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
    padding: 10,
    paddingRight: Space.l,
    borderRadius: Radius.miniPlayer,
    overflow: 'hidden',
  },
  body: { flex: 1, gap: 6 },
  title: { fontFamily: Fonts.sans, fontSize: 14, color: Colors.primary },
  meta: { fontFamily: Fonts.sans, fontSize: 12, color: Colors.inactive },
  fallback: { color: Colors.primary, fontSize: 16 },
});
