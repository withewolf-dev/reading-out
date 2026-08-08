import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ProgressTrack } from '@/components/progress-track';
import { ReadingArtwork } from '@/components/reading-artwork';
import { progressFraction, type ReadingRow } from '@/db';
import { Colors, CoverWidth, Fonts, Radius, Space, Track } from '@/theme';

type Props = { reading: ReadingRow; onPress: () => void; onLongPress: () => void };

function ShelfItemView({ reading, onPress, onLongPress }: Props) {
  const fraction = progressFraction(reading);
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={styles.item}>
      <ReadingArtwork
        title={reading.title}
        coverPath={reading.cover_path}
        width={CoverWidth.shelf}
        radius={Radius.shelfCover}
        showTitle
      />
      <Text numberOfLines={2} style={styles.title}>
        {reading.title}
      </Text>
      {/* progress as a glance, not a number (§15, Headway) */}
      <ProgressTrack fraction={fraction} height={Track.card} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: { width: CoverWidth.shelf, gap: Space.s },
  title: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.secondary },
});

export const ShelfItem = memo(ShelfItemView);
