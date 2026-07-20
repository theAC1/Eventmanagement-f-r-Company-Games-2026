import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { Button } from '@/components/ui';

export default function BestaetigungScreen() {
  const c = useColors();
  const router = useRouter();
  const { gameId, slug, gameName, teamName, punkte, pending } = useLocalSearchParams<{
    gameId: string;
    slug: string;
    gameName: string;
    teamName: string;
    punkte: string;
    pending: string;
  }>();
  const isPending = pending === '1';

  useEffect(() => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(
        isPending
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Success,
      );
    }
  }, [isPending]);

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <View style={[styles.check, { backgroundColor: isPending ? c.accent : c.primary }]}>
        <Feather
          name={isPending ? 'clock' : 'check'}
          size={48}
          color={isPending ? c.foreground : c.primaryForeground}
        />
      </View>

      <Text style={[styles.title, { color: c.foreground }]} testID="bestaetigung-title">
        {isPending ? 'Offline gespeichert' : 'Ergebnis gespeichert'}
      </Text>
      <Text style={[styles.sub, { color: c.mutedForeground }]}>
        {teamName} · {gameName}
      </Text>
      {isPending && (
        <Text style={[styles.sub, { color: c.mutedForeground, maxWidth: 300 }]}>
          Keine Verbindung — das Ergebnis wird automatisch übertragen, sobald wieder Empfang
          besteht. Den Status siehst du in der Spielübersicht.
        </Text>
      )}

      {!!punkte && (
        <View style={[styles.pointsCard, { backgroundColor: c.card, borderColor: c.border, borderRadius: c.radius }]}>
          <Text style={[styles.pointsValue, { color: c.primary }]}>{punkte}</Text>
          <Text style={[styles.pointsLabel, { color: c.mutedForeground }]}>Game-Punkte</Text>
        </View>
      )}

      <View style={{ gap: 12, width: '100%', marginTop: 32 }}>
        <Button
          label="Weiteres Team einchecken"
          icon="user-plus"
          onPress={() =>
            router.replace({
              pathname: '/referee/checkin',
              params: { gameId, slug, gameName },
            })
          }
          testID="next-team"
        />
        <Button
          label="Zur Spielübersicht"
          icon="list"
          variant="ghost"
          onPress={() => router.dismissAll()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  check: {
    width: 96,
    height: 96,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  sub: { fontSize: 15, fontFamily: 'Inter_400Regular', marginTop: 6, textAlign: 'center' },
  pointsCard: {
    marginTop: 24,
    borderWidth: 1,
    paddingVertical: 20,
    paddingHorizontal: 48,
    alignItems: 'center',
  },
  pointsValue: { fontSize: 48, fontFamily: 'Inter_700Bold', fontVariant: ['tabular-nums'] },
  pointsLabel: { fontSize: 13, fontFamily: 'Inter_500Medium', marginTop: 4 },
});
