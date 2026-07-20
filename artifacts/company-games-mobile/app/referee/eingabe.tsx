import React, { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { QRScanner } from '@/components/QRScanner';
import { Button, Card, ErrorState, Loading, Stepper, TextField } from '@/components/ui';
import { useCheckinTeam, useCreateErgebnis, useGetGameBySlug } from '@workspace/api-client-react';
import { parseQrToken } from '@/utils/parseQrToken';
import { enqueueErgebnis, isNetworkError, makeCommitId } from '@/lib/offline-queue';

type Feld = { name: string; typ?: string; label?: string; einheit?: string };

const NUMBER_TYPES = ['number', 'zahl', 'int', 'integer', 'zeit', 'time', 'punkte', 'anzahl'];
const BOOL_TYPES = ['boolean', 'bool', 'ja_nein', 'checkbox'];

function isNumberType(typ?: string) {
  return !typ || NUMBER_TYPES.includes(typ.toLowerCase());
}
function isBoolType(typ?: string) {
  return !!typ && BOOL_TYPES.includes(typ.toLowerCase());
}

export default function EingabeScreen() {
  const c = useColors();
  const router = useRouter();
  const {
    gameId,
    slug,
    gameName,
    teamId: initialTeamId,
    teamName: initialTeamName,
  } = useLocalSearchParams<{
    gameId: string;
    slug: string;
    gameName: string;
    teamId: string;
    teamName: string;
  }>();

  const [teamId, setTeamId] = useState(initialTeamId);
  const [teamName, setTeamName] = useState(initialTeamName);
  const [showScanner, setShowScanner] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const { data: game, isLoading, isError, refetch } = useGetGameBySlug(slug);
  // networkMode 'always': attempt the request even when the browser reports
  // offline, so our own offline queue (not react-query's pause) handles the
  // failure and enqueues the entry.
  const create = useCreateErgebnis({ mutation: { networkMode: 'always' } });
  const checkin = useCheckinTeam();
  const [error, setError] = useState<string | null>(null);
  // One idempotency key per form session: manual retries after a failure
  // reuse it, so the server can never record the same entry twice.
  const commitIdRef = React.useRef<string>(makeCommitId());

  const felder = useMemo<Feld[]>(() => {
    const wl = (game?.wertungslogik ?? null) as { eingabefelder?: Feld[] } | null;
    const fields = wl?.eingabefelder;
    if (Array.isArray(fields) && fields.length > 0) return fields;
    // Fallback: a single points field for games without a defined scheme.
    return [{ name: 'punkte', typ: 'number', label: 'Punkte' }];
  }, [game]);

  const [values, setValues] = useState<Record<string, unknown>>({});

  const setValue = (name: string, v: unknown) => setValues((prev) => ({ ...prev, [name]: v }));

  const onRescan = (value: string) => {
    setScanError(null);
    checkin.mutate(
      { data: { qrToken: parseQrToken(value) } },
      {
        onSuccess: (res) => {
          if (!res.verified || !res.teamId) {
            setScanError('Team nicht gefunden');
            return;
          }
          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
          setTeamId(res.teamId);
          setTeamName(res.teamName ?? 'Team');
          // New team → reset all form inputs.
          setValues({});
          setError(null);
          setShowScanner(false);
        },
        onError: () => setScanError('Team nicht gefunden. QR-Code prüfen.'),
      },
    );
  };

  const submit = () => {
    setError(null);
    // Build rohdaten, defaulting empty number fields to 0.
    const rohdaten: Record<string, unknown> = {};
    for (const f of felder) {
      const raw = values[f.name];
      if (isBoolType(f.typ)) {
        rohdaten[f.name] = !!raw;
      } else if (isNumberType(f.typ)) {
        rohdaten[f.name] = typeof raw === 'number' ? raw : Number(raw ?? 0) || 0;
      } else {
        rohdaten[f.name] = raw ?? '';
      }
    }

    const commitId = commitIdRef.current;
    create.mutate(
      { data: { gameId, teamId, rohdaten, commitId } },
      {
        onSuccess: (res) => {
          router.replace({
            pathname: '/referee/bestaetigung',
            params: {
              slug,
              gameId,
              teamId,
              gameName,
              teamName,
              punkte: res.gamePunkte != null ? String(res.gamePunkte) : '',
              eingetragenUm: res.eingetragenUm ? String(new Date(res.eingetragenUm as string).getTime()) : '',
            },
          });
        },
        onError: async (e) => {
          if (isNetworkError(e)) {
            // No connection: queue locally and retry automatically later.
            await enqueueErgebnis({
              commitId,
              gameId,
              teamId,
              gameName: gameName ?? '',
              teamName: teamName ?? '',
              slug: slug ?? '',
              rohdaten,
            });
            router.replace({
              pathname: '/referee/bestaetigung',
              params: { slug, gameId, gameName, teamName, punkte: '', pending: '1' },
            });
            return;
          }
          setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen');
        },
      },
    );
  };

  if (isLoading) return <Loading label="Lade Game…" />;
  if (isError || !game) {
    return <ErrorState message="Game konnte nicht geladen werden" onRetry={() => refetch()} />;
  }

  return (
    <KeyboardAwareScrollView
      bottomOffset={24}
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: c.background }}
      contentContainerStyle={{ padding: 20, gap: 18 }}
    >
      <View style={[styles.teamCard, { backgroundColor: c.card, borderColor: c.border, borderRadius: c.radius }]}>
        <Feather name="users" size={20} color={c.primary} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.teamName, { color: c.foreground }]}>{teamName}</Text>
          <Text style={[styles.gameName, { color: c.mutedForeground }]}>{gameName}</Text>
        </View>
        <Pressable
          onPress={() => {
            setScanError(null);
            setShowScanner((v) => !v);
          }}
          style={[styles.switchButton, { borderColor: c.border }]}
          testID="team-wechseln"
        >
          <Feather name={showScanner ? 'x' : 'maximize'} size={14} color={c.primary} />
          <Text style={{ color: c.primary, fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>
            {showScanner ? 'Abbrechen' : 'Wechseln'}
          </Text>
        </Pressable>
      </View>

      {showScanner && (
        <View style={{ gap: 10 }}>
          <Text style={[styles.gameName, { color: c.mutedForeground }]}>
            QR-Code des neuen Teams scannen
          </Text>
          <QRScanner onScan={onRescan} active={!checkin.isPending} />
          {scanError && (
            <View style={[styles.errorBox, { borderColor: c.destructive }]}>
              <Feather name="alert-circle" size={16} color={c.destructive} />
              <Text style={{ color: c.destructive, fontSize: 14, flex: 1 }}>{scanError}</Text>
            </View>
          )}
        </View>
      )}

      {felder.map((f) => (
        <Card key={f.name} style={{ gap: 12 }}>
          <Text style={[styles.fieldLabel, { color: c.foreground }]}>
            {f.label ?? f.name}
            {f.einheit ? ` (${f.einheit})` : ''}
          </Text>

          {isBoolType(f.typ) ? (
            <View style={styles.switchRow}>
              <Text style={{ color: c.mutedForeground, fontSize: 14 }}>
                {values[f.name] ? 'Ja' : 'Nein'}
              </Text>
              <Switch
                value={!!values[f.name]}
                onValueChange={(v) => setValue(f.name, v)}
                trackColor={{ true: c.primary, false: c.accent }}
                thumbColor="#fff"
              />
            </View>
          ) : isNumberType(f.typ) ? (
            <Stepper
              value={typeof values[f.name] === 'number' ? (values[f.name] as number) : 0}
              onChange={(v) => setValue(f.name, v)}
            />
          ) : (
            <TextField
              value={(values[f.name] as string) ?? ''}
              onChangeText={(t) => setValue(f.name, t)}
              placeholder="Eingabe"
            />
          )}
        </Card>
      ))}

      {error && (
        <View style={[styles.errorBox, { borderColor: c.destructive }]}>
          <Feather name="alert-circle" size={16} color={c.destructive} />
          <Text style={{ color: c.destructive, fontSize: 14, flex: 1 }}>{error}</Text>
        </View>
      )}

      <Button
        label="Ergebnis speichern"
        icon="save"
        onPress={submit}
        loading={create.isPending}
        testID="ergebnis-submit"
      />
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  teamCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderWidth: 1 },
  switchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  teamName: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  gameName: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 1 },
  fieldLabel: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
});
