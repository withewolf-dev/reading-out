import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, COVER_ASPECT, coverColors, Fonts, Radius } from '@/theme';

type Props = {
  title: string;
  coverPath?: string | null;
  width: number;
  radius?: number;
  /** Only set this where no other text is laid over the artwork (§17.23). */
  showTitle?: boolean;
};

function ReadingArtworkView({ title, coverPath, width, radius = Radius.shelfCover, showTitle }: Props) {
  const height = width / COVER_ASPECT;
  const [top, bottom] = coverColors(title);

  if (coverPath) {
    return (
      <Image
        source={{ uri: coverPath }}
        style={{ width, height, borderRadius: radius, backgroundColor: '#111' }}
        contentFit="cover"
      />
    );
  }

  return (
    <LinearGradient
      colors={[top, bottom]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={[styles.fallback, { width, height, borderRadius: radius }]}>
      {showTitle ? (
        <Text
          numberOfLines={4}
          style={[styles.title, { fontSize: Math.max(11, width * 0.13) }]}>
          {title}
        </Text>
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fallback: {
    justifyContent: 'flex-end',
    padding: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.stroke,
    overflow: 'hidden',
  },
  title: {
    fontFamily: Fonts.serif,
    // Artwork is its own surface: a saturated gradient, dark in either theme.
    // This text must not follow the app's ink scale or it turns black on green.
    color: 'rgba(255,255,255,0.96)',
    lineHeight: undefined,
  },
});

export const ReadingArtwork = memo(ReadingArtworkView);
