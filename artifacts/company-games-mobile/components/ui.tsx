import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { useColors } from '@/hooks/useColors';

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const c = useColors();
  return (
    <View
      style={[
        {
          backgroundColor: c.card,
          borderColor: c.border,
          borderWidth: 1,
          borderRadius: c.radius,
          padding: 16,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  testID,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  icon?: keyof typeof Feather.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
}) {
  const c = useColors();
  const isDisabled = disabled || loading;

  const bg =
    variant === 'primary'
      ? c.primary
      : variant === 'destructive'
        ? c.destructive
        : variant === 'secondary'
          ? c.secondary
          : 'transparent';
  const fg =
    variant === 'primary'
      ? c.primaryForeground
      : variant === 'destructive'
        ? c.destructiveForeground
        : c.foreground;

  return (
    <Pressable
      testID={testID}
      onPress={() => {
        if (isDisabled) return;
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        onPress();
      }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: bg,
          borderColor: variant === 'ghost' ? c.border : 'transparent',
          borderWidth: variant === 'ghost' ? 1 : 0,
          borderRadius: c.radius,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Feather name={icon} size={18} color={fg} />}
          <Text style={[styles.buttonLabel, { color: fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function TextField({
  label,
  style,
  ...props
}: TextInputProps & { label?: string }) {
  const c = useColors();
  return (
    <View style={{ gap: 6 }}>
      {label && (
        <Text style={{ color: c.mutedForeground, fontSize: 13, fontFamily: 'Inter_500Medium' }}>
          {label}
        </Text>
      )}
      <TextInput
        placeholderTextColor={c.mutedForeground}
        style={[
          {
            backgroundColor: c.background,
            borderColor: c.border,
            borderWidth: 1,
            borderRadius: c.radius,
            paddingHorizontal: 14,
            paddingVertical: 12,
            color: c.foreground,
            fontSize: 16,
            fontFamily: 'Inter_400Regular',
          },
          style as object,
        ]}
        {...props}
      />
    </View>
  );
}

export function Stepper({
  value,
  onChange,
  min = 0,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
}) {
  const c = useColors();
  return (
    <View style={styles.stepperRow}>
      <Pressable
        onPress={() => {
          if (Platform.OS !== 'web') Haptics.selectionAsync();
          onChange(Math.max(min, value - 1));
        }}
        style={[styles.stepBtn, { borderColor: c.border, borderRadius: c.radius }]}
      >
        <Feather name="minus" size={22} color={c.foreground} />
      </Pressable>
      <Text style={[styles.stepValue, { color: c.foreground }]}>{value}</Text>
      <Pressable
        onPress={() => {
          if (Platform.OS !== 'web') Haptics.selectionAsync();
          onChange(value + 1);
        }}
        style={[styles.stepBtn, { borderColor: c.border, borderRadius: c.radius }]}
      >
        <Feather name="plus" size={22} color={c.foreground} />
      </Pressable>
    </View>
  );
}

export function EmptyState({
  icon = 'inbox',
  title,
  subtitle,
}: {
  icon?: keyof typeof Feather.glyphMap;
  title: string;
  subtitle?: string;
}) {
  const c = useColors();
  return (
    <View style={styles.empty}>
      <Feather name={icon} size={40} color={c.mutedForeground} />
      <Text style={[styles.emptyTitle, { color: c.foreground }]}>{title}</Text>
      {subtitle && (
        <Text style={[styles.emptySub, { color: c.mutedForeground }]}>{subtitle}</Text>
      )}
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  const c = useColors();
  return (
    <View style={styles.empty}>
      <Feather name="alert-triangle" size={36} color={c.destructive} />
      <Text style={[styles.emptyTitle, { color: c.foreground }]}>Fehler</Text>
      <Text style={[styles.emptySub, { color: c.mutedForeground }]}>{message}</Text>
      {onRetry && (
        <View style={{ marginTop: 12 }}>
          <Button label="Erneut versuchen" icon="refresh-cw" variant="ghost" onPress={onRetry} />
        </View>
      )}
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  const c = useColors();
  return (
    <View style={styles.empty}>
      <ActivityIndicator color={c.primary} size="large" />
      {label && <Text style={[styles.emptySub, { color: c.mutedForeground }]}>{label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  buttonLabel: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  stepBtn: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  stepValue: {
    fontSize: 40,
    fontFamily: 'Inter_700Bold',
    minWidth: 72,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 4,
  },
  emptySub: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
});
