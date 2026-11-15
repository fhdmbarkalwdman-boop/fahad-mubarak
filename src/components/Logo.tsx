import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { AppText } from './ui';

/**
 * FAHDAR geometric mark: a hexagonal shield (structure/engineering) holding
 * an "F" built from three bars, with a spark dot — the idea that starts here.
 */
export function LogoMark({ size = 64 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel="FAHDAR">
      <Defs>
        <LinearGradient id="fhd-bg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#16305F" />
          <Stop offset="1" stopColor="#2C56D6" />
        </LinearGradient>
        <LinearGradient id="fhd-edge" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#6B91F7" />
          <Stop offset="1" stopColor="#0A1630" />
        </LinearGradient>
      </Defs>
      <Path d="M50 3 L91 26.5 L91 73.5 L50 97 L9 73.5 L9 26.5 Z" fill="url(#fhd-edge)" />
      <Path d="M50 8 L86.5 29 L86.5 71 L50 92 L13.5 71 L13.5 29 Z" fill="url(#fhd-bg)" />
      <Rect x="34" y="27" width="11" height="46" rx="2.5" fill="#FFFFFF" />
      <Rect x="34" y="27" width="33" height="11" rx="2.5" fill="#FFFFFF" />
      <Rect x="34" y="45.5" width="23" height="10" rx="2.5" fill="#A9C0FB" />
      <Circle cx="64.5" cy="66" r="5.5" fill="#6B91F7" />
      <Circle cx="64.5" cy="66" r="2.4" fill="#FFFFFF" />
    </Svg>
  );
}

export function LogoLockup({ size = 56, light = false }: { size?: number; light?: boolean }) {
  const color = light ? '#FFFFFF' : undefined;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <LogoMark size={size} />
      <View>
        <AppText weight="bold" style={{ fontSize: size * 0.42, letterSpacing: 3, color }}>FAHDAR</AppText>
        <AppText weight="medium" style={{ fontSize: size * 0.3, color, opacity: 0.85 }}>فَهْدَار</AppText>
      </View>
    </View>
  );
}
