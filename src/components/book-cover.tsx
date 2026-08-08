import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { COVER_ASPECT, coverColors } from '@/theme';

type Props = {
  title: string;
  /** A file URI for an imported book's first page, or a Metro asset handle. */
  coverPath?: string | number | null;
  width: number;
  /** Laid over the boards, above the spine and sheen. */
  children?: ReactNode;
};

/**
 * A cover drawn as a physical hardback rather than a flat rectangle.
 *
 * Four things make it read as an object: a spine down the left with the groove
 * that runs beside it, a sliver of page edge on the right, a sheen falling
 * across the boards, and a shadow that sits under the book rather than around
 * it. All four are proportional to `width`, so the same component works at
 * thumbnail and hero size.
 */
function BookCoverView({ title, coverPath, width, children }: Props) {
  const height = width / COVER_ASPECT;
  const spine = Math.max(4, width * 0.055);
  const radius = Math.max(3, width * 0.018);
  const [top, bottom] = coverColors(title);

  return (
    <View
      style={[
        styles.book,
        {
          width,
          height,
          borderRadius: radius,
          // A book leans on the surface below it, so the shadow drops rather
          // than haloing.
          shadowRadius: width * 0.06,
          shadowOffset: { width: width * 0.012, height: width * 0.045 },
        },
      ]}>
      <View style={[styles.boards, { borderRadius: radius }]}>
        {coverPath ? (
          <Image
            source={typeof coverPath === 'number' ? coverPath : { uri: coverPath }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        ) : (
          <LinearGradient
            colors={[top, bottom]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}

        {/* The page block, just proud of the boards on the fore edge. */}
        <LinearGradient
          colors={['rgba(255,255,255,0.34)', 'rgba(255,255,255,0.06)', 'rgba(0,0,0,0.10)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.foreEdge, { width: Math.max(2, width * 0.018) }]}
          pointerEvents="none"
        />

        {/* Spine, then the groove where the boards hinge against it. */}
        <LinearGradient
          colors={['rgba(0,0,0,0.42)', 'rgba(0,0,0,0.16)', 'rgba(255,255,255,0.16)', 'rgba(0,0,0,0.14)']}
          locations={[0, 0.55, 0.82, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.spine, { width: spine }]}
          pointerEvents="none"
        />

        {/* A single sheen across the boards, low enough not to wash the art. */}
        <LinearGradient
          colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0)', 'rgba(0,0,0,0.06)']}
          locations={[0, 0.42, 1]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.75, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  book: {
    backgroundColor: '#111',
    shadowColor: '#000000',
    shadowOpacity: 0.28,
  },
  // Clips the spine and edges to the rounded corners without clipping the
  // shadow, which lives on the parent.
  boards: { flex: 1, overflow: 'hidden', backgroundColor: '#111' },
  spine: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  foreEdge: { position: 'absolute', right: 0, top: 0, bottom: 0 },
});

export const BookCover = memo(BookCoverView);
