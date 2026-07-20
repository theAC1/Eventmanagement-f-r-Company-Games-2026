import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { QRScanner } from '@/components/QRScanner';
import { Button, Card, TextField } from '@/components/ui';
import { useCheckinTeam } from '@workspace/api-client-react';
import { parseQrToken } from '@/utils/parseQrToken';

type VerifiedTeam = { teamId: string; teamName: string };

export default function CheckinScreen() {
  const c = useColors();
  const router = useRouter();
  const { gameId, slug, gameName, slotId, teamCount } = useLocalSearchParams<{
    gameId: string;
    slug: string;
    gameName: string;
    slotId?: string;
    teamCount?: string;
  }>();

  const maxTeams = teamCount === '2' ? 2 : 1;
  const isDuell = maxTeams === 2;

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState<VerifiedTeam[]>([]);
  const checkin = useCheckinTeam();

  const allVerified = verified.length >= maxTeams;

  const goToEingabe = (teams: VerifiedTeam[]) => {
    const first = teams[0];
    router.push({
      pathname: '/referee/eingabe',
      params: {
        gameId,
        slug,
        gameName,
        teamId: first.teamId,
        teamName: first.teamName,
        ...(slotId ? { slotId } : {}),
      },
    });
  };

  const verify = (body: { qrToken?: string; checkinCode?: string }) => {
    setError(null);
    checkin.mutate(
      { data: { ...body, ...(slotId ? { slotId } : {}) } },
      {
        onSuccess: (res) => {
          if (!res.verified || !res.teamId) {
            setError('Team nicht gefunden');
            return;
          }
          if (verified.some((t) => t.teamId === res.teamId)) {
            setError(`${res.teamName ?? 'Team'} ist bereits verifiziert`);
            return;
          }
          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
          const team: VerifiedTeam = { teamId: res.teamId, teamName: res.teamName ?? 'Team' };
          const next = [...verified, team];
          setVerified(next);
          setCode('');
          if (next.length >= maxTeams && !isDuell) {
            // SOLO: direkt weiter wie bisher
            goToEingabe(next);
          }
        },
        onError: (e) =>
          setError(e instanceof Error && e.message ? e.message : 'Team nicht gefunden. Code prüfen.'),
      },
    );
  };

  const onScan = (value: string) => {
    verify({ qrToken: parseQrToken(value) });
  };

  const nextLabel = isDuell ? (verified.length === 0 ? 'Team A' : 'Team B') : 'Team';

  return (
    <KeyboardAwareScrollView
      bottomOffset={24}
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: c.background }}
      contentContainerStyle={{ padding: 20, gap: 20 }}
    >
      <View style={styles.gameHeader}>
        <Text style={[styles.eyebrow, { color: c.primary }]}>GAME</Text>
        <Text style={[styles.gameName, { color: c.foreground }]}>{gameName}</Text>
      </View>

      {/* Fortschritt bei Duell-Slots */}
      {isDuell && (
        <View
          testID="duell-progress"
          style={[styles.progressCard, { backgroundColor: c.card, borderColor: c.border, borderRadius: c.radius }]}
        >
          {[0, 1].map((i) => {
            const t = verified[i];
            return (
              <View key={i} style={styles.progressRow}>
                <Feather
                  name={t ? 'check-circle' : 'circle'}
                  size={18}
                  color={t ? '#10b981' : c.mutedForeground}
                />
                <Text
                  style={{
                    color: t ? c.foreground : c.mutedForeground,
                    fontSize: 14,
                    fontFamily: 'Inter_500Medium',
                    flex: 1,
                  }}
                >
                  {t ? `${t.teamName} ✓` : `Team ${i === 0 ? 'A' : 'B'} ausstehend`}
                </Text>
              </View>
            );
          })}
          <Text style={{ color: c.mutedForeground, fontSize: 12 }}>
            {verified.length} von 2 Teams verifiziert
          </Text>
        </View>
      )}

      {!allVerified && (
        <>
          <View style={{ gap: 10 }}>
            <Text style={[styles.sectionLabel, { color: c.mutedForeground }]}>
              QR-Code von {nextLabel} scannen
            </Text>
            <QRScanner onScan={onScan} active={!checkin.isPending} />
          </View>

          <View style={styles.divider}>
            <View style={[styles.line, { backgroundColor: c.border }]} />
            <Text style={{ color: c.mutedForeground, fontSize: 12 }}>ODER</Text>
            <View style={[styles.line, { backgroundColor: c.border }]} />
          </View>

          <Card style={{ gap: 14 }}>
            <TextField
              label="Check-in-Code"
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="z.B. ABC123"
              testID="checkin-code"
            />
            <Button
              label={`${nextLabel} bestätigen`}
              icon="check"
              onPress={() => verify({ checkinCode: code.trim() })}
              loading={checkin.isPending}
              disabled={!code.trim()}
              testID="checkin-submit"
            />
          </Card>
        </>
      )}

      {isDuell && (
        <Button
          label="Weiter zur Eingabe"
          icon="arrow-right"
          onPress={() => goToEingabe(verified)}
          disabled={!allVerified}
          testID="weiter-zur-eingabe"
        />
      )}

      {error && (
        <View style={[styles.errorBox, { borderColor: c.destructive }]}>
          <Feather name="alert-circle" size={16} color={c.destructive} />
          <Text style={{ color: c.destructive, fontSize: 14, flex: 1 }}>{error}</Text>
        </View>
      )}
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  gameHeader: { gap: 2 },
  eyebrow: { fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 2 },
  gameName: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  sectionLabel: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  line: { flex: 1, height: 1 },
  progressCard: { borderWidth: 1, padding: 14, gap: 10 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
});
