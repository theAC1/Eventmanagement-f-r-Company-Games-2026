import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { QRScanner } from '@/components/QRScanner';
import { Button, Card, ErrorState, Loading, TextField } from '@/components/ui';
import {
  getGetRanglisteQueryKey,
  useGetRangliste,
  useGetTeamPortal,
  type RanglisteEntry,
} from '@workspace/api-client-react';

export default function TeamScreen() {
  const [token, setToken] = useState<string | null>(null);
  return token ? (
    <TeamPortal token={token} onReset={() => setToken(null)} />
  ) : (
    <TokenEntry onToken={setToken} />
  );
}

function TokenEntry({ onToken }: { onToken: (t: string) => void }) {
  const c = useColors();
  const [manual, setManual] = useState('');

  const onScan = (value: string) => {
    let t = value.trim();
    try {
      const url = new URL(value);
      t = url.searchParams.get('token') ?? url.pathname.split('/').filter(Boolean).pop() ?? t;
    } catch {
      // raw token
    }
    if (t) onToken(t);
  };

  return (
    <KeyboardAwareScrollView
      bottomOffset={24}
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: c.background }}
      contentContainerStyle={{ padding: 20, gap: 20 }}
    >
      <Text style={[styles.intro, { color: c.mutedForeground }]}>
        Scanne den QR-Code deines Teams, um Stand und Rangliste zu sehen.
      </Text>
      <QRScanner onScan={onScan} />
      <View style={styles.divider}>
        <View style={[styles.line, { backgroundColor: c.border }]} />
        <Text style={{ color: c.mutedForeground, fontSize: 12 }}>ODER</Text>
        <View style={[styles.line, { backgroundColor: c.border }]} />
      </View>
      <Card style={{ gap: 14 }}>
        <TextField
          label="Team-Code"
          value={manual}
          onChangeText={setManual}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Team-Token eingeben"
          testID="team-token"
        />
        <Button
          label="Portal öffnen"
          icon="arrow-right"
          onPress={() => onToken(manual.trim())}
          disabled={!manual.trim()}
          testID="team-token-submit"
        />
      </Card>
    </KeyboardAwareScrollView>
  );
}

function TeamPortal({ token, onReset }: { token: string; onReset: () => void }) {
  const c = useColors();
  const portal = useGetTeamPortal(token);
  const rangliste = useGetRangliste({
    query: { queryKey: getGetRanglisteQueryKey(), refetchInterval: 10_000 },
  });

  if (portal.isLoading) return <Loading label="Lade Team…" />;
  if (portal.isError || !portal.data?.teamId) {
    return (
      <ErrorState message="Team nicht gefunden. QR-Code oder Code prüfen." onRetry={onReset} />
    );
  }

  const team = portal.data;
  const entries = rangliste.data?.rangliste ?? [];
  const myEntry = entries.find((e) => e.teamId === team.teamId);

  return (
    <KeyboardAwareScrollView
      style={{ backgroundColor: c.background }}
      contentContainerStyle={{ padding: 20, gap: 16 }}
    >
      <View style={[styles.teamHero, { backgroundColor: c.card, borderColor: c.border, borderRadius: c.radius }]}>
        <Feather name="users" size={28} color={c.primary} />
        <Text style={[styles.teamName, { color: c.foreground }]}>{team.teamName}</Text>
        {myEntry ? (
          <View style={styles.heroStats}>
            <Stat label="Rang" value={`#${myEntry.gesamtRang}`} />
            <Stat label="Punkte" value={String(myEntry.rangPunkteSumme)} />
            <Stat label="Games" value={`${myEntry.gamesGespielt}/${myEntry.gamesTotal}`} />
          </View>
        ) : (
          <Text style={{ color: c.mutedForeground, fontSize: 13 }}>
            Noch keine Ergebnisse erfasst
          </Text>
        )}
      </View>

      <Text style={[styles.sectionTitle, { color: c.foreground }]}>Rangliste</Text>
      {rangliste.isLoading ? (
        <Loading />
      ) : (
        <View style={{ gap: 8 }}>
          {entries.map((e) => (
            <RankRow key={e.teamId} entry={e} highlight={e.teamId === team.teamId} />
          ))}
          {entries.length === 0 && (
            <Text style={{ color: c.mutedForeground, textAlign: 'center', padding: 20 }}>
              Noch keine Rangliste verfügbar.
            </Text>
          )}
        </View>
      )}

      <Button label="Anderes Team" icon="repeat" variant="ghost" onPress={onReset} />
    </KeyboardAwareScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const c = useColors();
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={[styles.statValue, { color: c.primary }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: c.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function RankRow({ entry, highlight }: { entry: RanglisteEntry; highlight: boolean }) {
  const c = useColors();
  return (
    <View
      style={[
        styles.rankRow,
        {
          backgroundColor: c.card,
          borderColor: highlight ? c.primary : c.border,
          borderRadius: c.radius,
        },
      ]}
    >
      <Text style={[styles.rank, { color: highlight ? c.primary : c.mutedForeground }]}>
        {entry.gesamtRang}
      </Text>
      <Text style={[styles.rankTeam, { color: c.foreground }]} numberOfLines={1}>
        {entry.teamName}
      </Text>
      <Text style={[styles.rankPoints, { color: c.foreground }]}>{entry.rangPunkteSumme}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  line: { flex: 1, height: 1 },
  teamHero: { alignItems: 'center', gap: 10, padding: 24, borderWidth: 1 },
  teamName: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  heroStats: { flexDirection: 'row', gap: 36, marginTop: 8 },
  statValue: { fontSize: 22, fontFamily: 'Inter_700Bold', fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  sectionTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold', marginTop: 6 },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderWidth: 1 },
  rank: { width: 28, textAlign: 'center', fontSize: 15, fontFamily: 'Inter_700Bold' },
  rankTeam: { flex: 1, fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  rankPoints: { fontSize: 16, fontFamily: 'Inter_700Bold', fontVariant: ['tabular-nums'] },
});
