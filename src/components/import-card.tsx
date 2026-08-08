import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Screen, Space } from '@/theme';

type Props = {
  onImport: () => void;
  /** Omit to make the card permanent. */
  onDismiss?: () => void;
};

/**
 * The first thing on the library: an invitation to bring your own book.
 *
 * Deliberately the one saturated surface in a white app — it has to read as an
 * offer rather than as another shelf, and it sits above the artwork so it is
 * seen before thirty covers pull the eye sideways.
 *
 * The page motif is clipped by the card's own rounding rather than fitted
 * inside it: a shape that runs off the edge suggests the card is a window onto
 * something larger, where a centred icon would just look like decoration.
 */
export function ImportCard({ onImport, onDismiss }: Props) {
  return (
    <LinearGradient
      colors={['#3B0F86', '#5B21B6', '#7C3AED']}
      locations={[0, 0.55, 1]}
      start={{ x: 0.05, y: 0 }}
      end={{ x: 0.95, y: 1 }}
      style={styles.card}>
      {/* A cool wash across the top so the flat violet does not read as a
          rectangle of paint. */}
      <LinearGradient
        colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0)']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 0.7 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={styles.motif} pointerEvents="none">
        <SymbolView
          name="doc.text"
          size={210}
          tintColor="rgba(255,255,255,0.10)"
          fallback={<View />}
        />
      </View>

      {onDismiss ? (
        <Pressable
          onPress={onDismiss}
          hitSlop={14}
          style={styles.close}
          accessibilityRole="button"
          accessibilityLabel="Dismiss">
          <SymbolView
            name="xmark"
            size={15}
            tintColor="rgba(255,255,255,0.75)"
            fallback={<Text style={styles.closeFallback}>✕</Text>}
          />
        </Pressable>
      ) : null}

      <Text style={styles.eyebrow}>YOUR LIBRARY</Text>

      <Text style={styles.title}>
        Bring your{'\n'}own book.
      </Text>

      <Text style={styles.body}>
        Any text file from your phone or iCloud, read aloud in the same voice, with the same
        word-by-word highlighting.
      </Text>

      <Pressable
        onPress={onImport}
        accessibilityRole="button"
        accessibilityLabel="Import a book"
        style={({ pressed }) => [styles.button, pressed && { opacity: 0.75 }]}>
        <SymbolView
          name="plus"
          size={14}
          tintColor="#3B0F86"
          fallback={<Text style={styles.buttonIconFallback}>+</Text>}
        />
        <Text style={styles.buttonLabel}>Import a book</Text>
      </Pressable>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: Screen.margin,
    minHeight: 320,
    borderRadius: 24,
    paddingHorizontal: Space.xl + Space.xs,
    paddingTop: Space.xl + Space.m,
    paddingBottom: Space.xl + Space.xs,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  // Bleeds off the bottom-right corner and is cut by the card's rounding.
  motif: { position: 'absolute', right: -46, bottom: -54 },
  close: { position: 'absolute', top: Space.l, right: Space.l, zIndex: 2 },
  closeFallback: { color: 'rgba(255,255,255,0.75)', fontSize: 15 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: 'rgba(255,255,255,0.55)',
  },
  title: {
    marginTop: Space.m,
    fontSize: 34,
    fontWeight: '700',
    lineHeight: 39,
    letterSpacing: -0.6,
    color: '#FFFFFF',
  },
  body: {
    marginTop: Space.m,
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.72)',
    paddingRight: Space.xl,
  },
  button: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: Space.xl + Space.xs,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 13,
  },
  buttonLabel: { fontSize: 15, fontWeight: '600', color: '#3B0F86' },
  buttonIconFallback: { color: '#3B0F86', fontSize: 14 },
});
