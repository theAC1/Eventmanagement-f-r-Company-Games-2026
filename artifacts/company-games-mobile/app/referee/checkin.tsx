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

export default function CheckinScreen() {
  const c = useColors();
  const router = useRouter();
  const { gameId, slug, gameName } = useLocalSearchParams<{
    gameId: string;
    slug: string;
    gameName: string;
  }>();

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const checkin = useCheckinTeam();

  const verify = (body: { qrToken?: string; checkinCode?: string }) => {
    setError(null);
    checkin.mutate(
      { data: body },
      {
        onSuccess: (res) => {
          if (!res.verified || !res.teamId) {
            setError('Team nicht gefunden');
            return;
          }
          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
          router.push({
            pathname: '/referee/eingabe',
            params: {
              gameId,
              slug,
              gameName,
              teamId: res.teamId,
              teamName: res.teamName ?? 'Team',
            },
          });
        },
        onError: () => setError('Team nicht gefunden. Code prüfen.'),
      },
    );
  };

  const onScan = (value: string) => {
    // QR payload may be a raw token or a URL containing the token as the
    // last path segment / a `token` query param.
    let token = value.trim();
    try {
      const url = new URL(value);
      token = url.searchParams.get('token') ?? url.pathname.split('/').filter(Boolean).pop() ?? token;
    } catch {
      // Not a URL — use the raw value.
    }
    verify({ qrToken: token });
  };

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

      <View style={{ gap: 10 }}>
        <Text style={[styles.sectionLabel, { color: c.mutedForeground }]}>
          QR-Code des Teams scannen
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
          label="Team bestätigen"
          icon="check"
          onPress={() => verify({ checkinCode: code.trim() })}
          loading={checkin.isPending}
          disabled={!code.trim()}
          testID="checkin-submit"
        />
      </Card>

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
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
});
