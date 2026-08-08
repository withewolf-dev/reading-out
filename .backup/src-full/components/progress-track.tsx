import { memo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { Colors } from '@/theme';

type Props = { fraction: number; height?: number; style?: ViewStyle };

function ProgressTrackView({ fraction, height = 3, style }: Props) {
  const clamped = Math.min(1, Math.max(0, fraction));
  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }, style]}>
      <View
        style={[
          styles.fill,
          { width: `${clamped * 100}%`, borderRadius: height / 2 },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', backgroundColor: Colors.trackEmpty, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: Colors.trackFill },
});

export const ProgressTrack = memo(ProgressTrackView);
