import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

type Props = {
  /**
   * Must be translucent. A solid colour here covers the material and the panel
   * stops looking like glass — it reads as a painted bar instead.
   */
  tintColor?: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/**
 * Liquid Glass where the OS has it (iOS 26+), a full-strength system blur
 * material otherwise. Never put an opaque fill inside one of these.
 */
export function GlassPanel({ tintColor, style, children }: Props) {
  if (isLiquidGlassAvailable()) {
    return (
      <GlassView glassEffectStyle="regular" colorScheme="light" tintColor={tintColor} style={style}>
        {children}
      </GlassView>
    );
  }
  return (
    <BlurView tint="systemChromeMaterialLight" intensity={100} style={style}>
      {children}
    </BlurView>
  );
}
