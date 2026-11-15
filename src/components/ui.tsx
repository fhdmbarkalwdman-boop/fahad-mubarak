import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { type ComponentProps, type ReactNode, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { errorKey } from '../lib/errors';
import { usePrefs } from '../lib/prefs';
import { fonts, radius } from '../lib/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

// ---------------------------------------------------------------- text
type Weight = 'regular' | 'medium' | 'semibold' | 'bold';
export function AppText({
  weight = 'regular',
  muted,
  size,
  style,
  ...rest
}: TextProps & { weight?: Weight; muted?: boolean; size?: number }) {
  const { colors } = usePrefs();
  return (
    <Text
      {...rest}
      style={[
        { fontFamily: fonts[weight], color: muted ? colors.textMuted : colors.text, fontSize: size ?? 15, lineHeight: (size ?? 15) * 1.6, textAlign: 'auto' } as TextStyle,
        style,
      ]}
    />
  );
}

export function Title({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <AppText weight="bold" size={22} style={style}>{children}</AppText>;
}

// ---------------------------------------------------------------- layout
export function Screen({
  children,
  refreshing,
  onRefresh,
  padded = true,
  scroll = true,
  contentStyle,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  padded?: boolean;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const { colors } = usePrefs();
  const insets = useSafeAreaInsets();
  const pad: ViewStyle = padded ? { padding: 16, gap: 16 } : {};
  if (!scroll) return <View style={[{ flex: 1, backgroundColor: colors.bg }, pad, contentStyle]}>{children}</View>;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={[pad, { paddingBottom: 32 + insets.bottom }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

export function FadeIn({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 380, delay, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [v, delay]);
  return (
    <Animated.View
      style={[{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }, style]}
    >
      {children}
    </Animated.View>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const { colors, scheme } = usePrefs();
  const base: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 16,
    gap: 8,
    ...(scheme === 'light'
      ? { shadowColor: '#0A1630', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 }
      : {}),
  };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [base, { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] }, style]}>
      {children}
    </Pressable>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const { colors } = usePrefs();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
      <AppText weight="bold" size={18}>{title}</AppText>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={10}>
          <AppText weight="semibold" size={14} style={{ color: colors.accent }}>{action}</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------- buttons
type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';
export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  style,
  small,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const { colors } = usePrefs();
  const bg = {
    primary: colors.primary,
    accent: colors.accent,
    secondary: colors.accentSoft,
    ghost: 'transparent',
    danger: colors.danger,
  }[variant];
  const fg = variant === 'secondary' || variant === 'ghost' ? colors.accent : colors.primaryText;
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={() => {
        if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => undefined);
        onPress?.();
      }}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          minHeight: small ? 38 : 50,
          paddingHorizontal: small ? 14 : 20,
          borderRadius: radius.md,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: inactive ? 0.5 : pressed ? 0.85 : 1,
          borderWidth: variant === 'ghost' ? 1 : 0,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Ionicons name={icon} size={small ? 16 : 19} color={fg} /> : null}
      <AppText weight="semibold" size={small ? 13 : 15} style={{ color: fg }}>{title}</AppText>
    </Pressable>
  );
}

export function IconButton({ icon, onPress, label, color }: { icon: IconName; onPress: () => void; label: string; color?: string }) {
  const { colors } = usePrefs();
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({ padding: 8, borderRadius: radius.pill, backgroundColor: pressed ? colors.surfaceAlt : 'transparent' })}
    >
      <Ionicons name={icon} size={22} color={color ?? colors.text} />
    </Pressable>
  );
}

// ---------------------------------------------------------------- inputs
export function Field({
  label,
  hint,
  error,
  optional,
  style,
  multiline,
  ...input
}: TextInputProps & { label: string; hint?: string; error?: string | null; optional?: boolean }) {
  const { colors, t, isRTL } = usePrefs();
  return (
    <View style={{ gap: 6 }}>
      <AppText weight="semibold" size={14}>
        {label}
        {optional ? <AppText muted size={12}>{`  (${t('optional')})`}</AppText> : null}
      </AppText>
      <TextInput
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        {...input}
        style={[
          {
            fontFamily: fonts.regular,
            fontSize: 15,
            color: colors.text,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: error ? colors.danger : colors.border,
            borderRadius: radius.md,
            paddingHorizontal: 14,
            paddingVertical: multiline ? 12 : 0,
            minHeight: multiline ? 110 : 50,
            textAlign: isRTL ? 'right' : 'left',
            textAlignVertical: multiline ? 'top' : 'center',
          },
          style,
        ]}
      />
      {error ? <AppText size={12} style={{ color: colors.danger }}>{error}</AppText> : hint ? <AppText muted size={12}>{hint}</AppText> : null}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
}) {
  const { colors } = usePrefs();
  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: radius.pill,
        backgroundColor: selected ? colors.accent : colors.accentSoft,
        borderWidth: 1,
        borderColor: selected ? colors.accent : 'transparent',
      }}
    >
      {icon ? <Ionicons name={icon} size={14} color={selected ? '#fff' : colors.accent} /> : null}
      <AppText weight="medium" size={13} style={{ color: selected ? '#fff' : colors.accent, lineHeight: 20 }}>{label}</AppText>
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!selected }} onPress={onPress}>
      {content}
    </Pressable>
  );
}

export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T | T[] | null;
  onChange: (v: T) => void;
  label?: string;
}) {
  const selected = (v: T) => (Array.isArray(value) ? value.includes(v) : value === v);
  return (
    <View style={{ gap: 8 }}>
      {label ? <AppText weight="semibold" size={14}>{label}</AppText> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((o) => (
          <Chip key={o.value} label={o.label} selected={selected(o.value)} onPress={() => onChange(o.value)} />
        ))}
      </View>
    </View>
  );
}

export function Tags({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {items.map((x) => <Chip key={x} label={x} />)}
    </View>
  );
}

export function ToggleRow({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  const { colors } = usePrefs();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 4 }}>
      <View style={{ flex: 1 }}>
        <AppText weight="semibold" size={14}>{label}</AppText>
        {hint ? <AppText muted size={12}>{hint}</AppText> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.accent, false: colors.border }} thumbColor="#fff" />
    </View>
  );
}

export function ListRow({
  icon,
  label,
  value,
  onPress,
  badge,
  danger,
}: {
  icon: IconName;
  label: string;
  value?: string;
  onPress?: () => void;
  badge?: number;
  danger?: boolean;
}) {
  const { colors, isRTL } = usePrefs();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: danger ? '#D6454520' : colors.accentSoft }}>
        <Ionicons name={icon} size={19} color={danger ? colors.danger : colors.accent} />
      </View>
      <AppText weight="medium" style={{ flex: 1, color: danger ? colors.danger : colors.text }}>{label}</AppText>
      {badge ? (
        <View style={{ minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' }}>
          <AppText weight="bold" size={11} style={{ color: '#fff', lineHeight: 16 }}>{badge > 99 ? '99+' : badge}</AppText>
        </View>
      ) : null}
      {value ? <AppText muted size={13}>{value}</AppText> : null}
      {onPress ? <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.textMuted} /> : null}
    </Pressable>
  );
}

export function Divider() {
  const { colors } = usePrefs();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />;
}

export function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={{ alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: color + '22' }}>
      <AppText weight="semibold" size={12} style={{ color, lineHeight: 18 }}>{label}</AppText>
    </View>
  );
}

export function Banner({ text, tone = 'info', icon }: { text: string; tone?: 'info' | 'warning' | 'danger' | 'success'; icon?: IconName }) {
  const { colors } = usePrefs();
  const c = colors[tone];
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', padding: 12, borderRadius: radius.md, backgroundColor: c + '1A', borderWidth: 1, borderColor: c + '40' }}>
      <Ionicons name={icon ?? (tone === 'success' ? 'checkmark-circle' : tone === 'info' ? 'information-circle' : 'alert-circle')} size={20} color={c} />
      <AppText size={14} style={{ flex: 1 }}>{text}</AppText>
    </View>
  );
}

// ---------------------------------------------------------------- states
export function LoadingView() {
  const { colors, t } = usePrefs();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12, backgroundColor: colors.bg }}>
      <ActivityIndicator size="large" color={colors.accent} />
      <AppText muted>{t('loading')}</AppText>
    </View>
  );
}

export function ErrorView({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { colors, t } = usePrefs();
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12, backgroundColor: colors.bg, flexGrow: 1 }}>
      <Ionicons name="cloud-offline-outline" size={44} color={colors.textMuted} />
      <AppText weight="semibold" style={{ textAlign: 'center' }}>{t(errorKey(error))}</AppText>
      {onRetry ? <Button title={t('retry')} variant="secondary" icon="refresh" onPress={onRetry} small /> : null}
    </View>
  );
}

export function EmptyView({ text, icon = 'file-tray-outline', action }: { text: string; icon?: IconName; action?: ReactNode }) {
  const { colors } = usePrefs();
  return (
    <View style={{ alignItems: 'center', padding: 24, gap: 10 }}>
      <Ionicons name={icon} size={40} color={colors.textMuted} />
      <AppText muted style={{ textAlign: 'center' }}>{text}</AppText>
      {action}
    </View>
  );
}

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const { colors } = usePrefs();
  const initials = name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '؟';
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
      <AppText weight="bold" size={size * 0.36} style={{ color: colors.accent, lineHeight: size * 0.5 }}>{initials}</AppText>
    </View>
  );
}
