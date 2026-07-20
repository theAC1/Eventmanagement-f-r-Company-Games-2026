import React from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';

type HubItem = {
  href: '/scoreboard' | '/referee' | '/team';
  title: string;
  subtitle: string;
  icon: keyof typeof Feather.glyphMap;
};

const ITEMS: HubItem[] = [
  {
    href: '/scoreboard',
    title: 'Live Rangliste',
    subtitle: 'Aktueller Punktestand aller Teams',
    icon: 'bar-chart-2',
  },
  {
    href: '/referee',
    title: 'Schiedsrichter',
    subtitle: 'Check-in & Ergebnisse erfassen',
    icon: 'clipboard',
  },
  {
    href: '/team',
    title: 'Team-Portal',
    subtitle: 'QR-Code scannen für deinen Stand',
    icon: 'users',
  },
];

export default function HomeScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { user, isReferee } = useAuth();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <ScrollView
      style={{ backgroundColor: c.background }}
      contentContainerStyle={{ paddingTop: topPad + 24, paddingBottom: 40, paddingHorizontal: 20 }}
    >
      <View style={styles.header}>
        <Image
          source={require('@/assets/images/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={[styles.eyebrow, { color: c.primary }]}>COMPANY GAMES</Text>
        <Text style={[styles.title, { color: c.foreground }]}>2026</Text>
        <Text style={[styles.tagline, { color: c.mutedForeground }]}>
          Der Begleiter für den Spieltag
        </Text>
      </View>

      {isReferee && (
        <View style={[styles.badge, { backgroundColor: c.card, borderColor: c.border }]}>
          <Feather name="check-circle" size={16} color={c.primary} />
          <Text style={[styles.badgeText, { color: c.foreground }]}>
            Angemeldet als {user?.name}
          </Text>
        </View>
      )}

      <View style={{ gap: 12, marginTop: 8 }}>
        {ITEMS.map((item) => (
          <Link key={item.href} href={item.href} asChild>
            <Pressable
              testID={`hub-${item.href}`}
              style={({ pressed }) => [
                styles.tile,
                {
                  backgroundColor: c.card,
                  borderColor: c.border,
                  borderRadius: c.radius,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View style={[styles.tileIcon, { backgroundColor: c.accent, borderRadius: c.radius }]}>
                <Feather name={item.icon} size={22} color={c.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.tileTitle, { color: c.foreground }]}>{item.title}</Text>
                <Text style={[styles.tileSub, { color: c.mutedForeground }]}>{item.subtitle}</Text>
              </View>
              <Feather name="chevron-right" size={22} color={c.mutedForeground} />
            </Pressable>
          </Link>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', marginBottom: 28 },
  logo: { width: 88, height: 88, marginBottom: 12 },
  eyebrow: { fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: 4 },
  title: { fontSize: 56, fontFamily: 'Inter_700Bold', lineHeight: 60 },
  tagline: { fontSize: 15, fontFamily: 'Inter_400Regular', marginTop: 4 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 999,
    marginBottom: 20,
  },
  badgeText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderWidth: 1,
  },
  tileIcon: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  tileTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  tileSub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
});
