import React, { useLayoutEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { FlatList } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useGetMeineSlots, getGetMeineSlotsQueryKey, type MeinSlot } from '@workspace/api-client-react';
import { Button, Card, EmptyState, ErrorState, Loading, TextField } from '@/components/ui';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';

export default function RefereeHome() {
  const { isReferee, isLoading } = useAuth();
  if (isLoading) return <Loading />;
  return isReferee ? <MySlotsList /> : <LoginForm />;
}

function LoginForm() {
  const c = useColors();
  const { signIn } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    if (!username.trim() || !password) {
      setError('Benutzername und Passwort erforderlich');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(username.trim(), password);
    } catch {
      setError('Ungültige Anmeldedaten');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAwareScrollView
      bottomOffset={24}
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: c.background }}
      contentContainerStyle={{ padding: 20, gap: 20 }}
    >
      <View style={{ alignItems: 'center', marginTop: 24, gap: 8 }}>
        <View style={[styles.lock, { backgroundColor: c.card, borderColor: c.border }]}>
          <Feather name="shield" size={28} color={c.primary} />
        </View>
        <Text style={[styles.loginTitle, { color: c.foreground }]}>Schiedsrichter-Login</Text>
        <Text style={[styles.loginSub, { color: c.mutedForeground }]}>
          Melde dich an, um Ergebnisse zu erfassen
        </Text>
      </View>

      <Card style={{ gap: 16 }}>
        <TextField
          label="Benutzername"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="benutzername"
          testID="login-username"
        />
        <TextField
          label="Passwort"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
          testID="login-password"
          onSubmitEditing={onSubmit}
        />
        {error && <Text style={{ color: c.destructive, fontSize: 13 }}>{error}</Text>}
        <Button label="Anmelden" icon="log-in" onPress={onSubmit} loading={busy} testID="login-submit" />
      </Card>
    </KeyboardAwareScrollView>
  );
}

function MySlotsList() {
  const c = useColors();
  const router = useRouter();
  const navigation = useNavigation();
  const { user, signOut } = useAuth();
  const { data, isLoading, isError, error, refetch } = useGetMeineSlots({
    query: { queryKey: getGetMeineSlotsQueryKey(), refetchInterval: 10_000 },
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={signOut} hitSlop={10} testID="logout">
          <Feather name="log-out" size={20} color={c.mutedForeground} />
        </Pressable>
      ),
    });
  }, [navigation, signOut, c.mutedForeground]);

  if (isLoading) return <Loading label="Lade Einsätze…" />;
  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : 'Einsätze konnten nicht geladen werden'}
        onRetry={() => refetch()}
      />
    );
  }

  const slots = data?.slots ?? [];
  // Offene Slots chronologisch, abgeschlossene ausgegraut ans Ende
  const ordered = [
    ...slots.filter((s) => s.status !== 'ABGESCHLOSSEN'),
    ...slots.filter((s) => s.status === 'ABGESCHLOSSEN'),
  ];

  return (
    <FlatList
      data={ordered}
      keyExtractor={(s) => s.slotId}
      scrollEnabled={ordered.length > 0}
      style={{ backgroundColor: c.background }}
      contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
      ListHeaderComponent={
        <View style={{ gap: 10 }}>
          <PendingQueueCard />
          <Text style={[styles.hello, { color: c.mutedForeground }]}>
            Hallo {user?.name} · Dein Tagesplan
          </Text>
        </View>
      }
      renderItem={({ item }) => <SlotRow slot={item} onPress={() => openSlot(router, item)} />}
      ListEmptyComponent={
        <EmptyState
          icon="calendar"
          title="Noch keine Einsätze zugeteilt"
          subtitle="Sobald dir die Orga Begegnungen zuweist, erscheinen sie hier."
        />
      }
    />
  );
}

function PendingQueueCard() {
  const c = useColors();
  const { queue, syncing, retryNow } = useOfflineQueue();
  if (queue.length === 0) return null;

  return (
    <View
      testID="pending-queue"
      style={[styles.pendingCard, { backgroundColor: c.card, borderColor: c.border, borderRadius: c.radius }]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Feather name="upload-cloud" size={18} color={c.primary} />
        <Text style={[styles.pendingTitle, { color: c.foreground }]}>
          {queue.length === 1
            ? '1 Ergebnis wartet auf Übertragung'
            : `${queue.length} Ergebnisse warten auf Übertragung`}
        </Text>
      </View>
      {queue.map((e) => (
        <View key={e.commitId} style={styles.pendingRow}>
          <Feather name="clock" size={14} color={c.mutedForeground} />
          <Text style={{ color: c.mutedForeground, fontSize: 13, flex: 1 }} numberOfLines={1}>
            {e.teamName} · {e.gameName}
          </Text>
          {e.attempts > 0 && (
            <Text style={{ color: c.mutedForeground, fontSize: 11 }}>
              {e.attempts}. Versuch fehlgeschlagen
            </Text>
          )}
        </View>
      ))}
      <Button
        label={syncing ? 'Übertrage…' : 'Jetzt synchronisieren'}
        icon="refresh-cw"
        variant="ghost"
        onPress={() => void retryNow()}
        loading={syncing}
        testID="sync-now"
      />
    </View>
  );
}

function openSlot(router: ReturnType<typeof useRouter>, slot: MeinSlot) {
  if (slot.status === 'ABGESCHLOSSEN') return;
  router.push({
    pathname: '/referee/checkin',
    params: {
      gameId: slot.gameId,
      slug: slot.gameSlug,
      gameName: slot.gameName,
      slotId: slot.slotId,
      teamCount: String(slot.teamIds.length >= 2 ? 2 : 1),
      teamNames: slot.teamNames.join(' vs. '),
    },
  });
}

function formatTime(z: string) {
  return z.slice(0, 5);
}

function StatusBadge({ status }: { status: string }) {
  const c = useColors();
  const cfg =
    status === 'AKTIV'
      ? { label: 'Läuft', color: '#f59e0b' }
      : status === 'ABGESCHLOSSEN'
        ? { label: 'Fertig', color: '#10b981' }
        : { label: 'Geplant', color: c.mutedForeground };
  return (
    <View style={[styles.badge, { borderColor: cfg.color }]}>
      <Text style={{ color: cfg.color, fontSize: 11, fontFamily: 'Inter_600SemiBold' }}>
        {cfg.label}
      </Text>
    </View>
  );
}

function SlotRow({ slot, onPress }: { slot: MeinSlot; onPress: () => void }) {
  const c = useColors();
  const done = slot.status === 'ABGESCHLOSSEN';
  return (
    <Pressable
      onPress={onPress}
      disabled={done}
      testID={`slot-${slot.slotId}`}
      style={({ pressed }) => [
        styles.gameRow,
        {
          backgroundColor: c.card,
          borderColor: c.border,
          borderRadius: c.radius,
          opacity: done ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.slotTime, { color: c.mutedForeground }]}>
          {formatTime(slot.startZeit)} – {formatTime(slot.endZeit)}
        </Text>
        <Text style={[styles.gameName, { color: c.foreground }]}>{slot.gameName}</Text>
        <Text style={[styles.gameMeta, { color: c.mutedForeground }]}>
          {slot.teamNames.length > 0 ? slot.teamNames.join(' vs. ') : 'Keine Teams zugewiesen'}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        <StatusBadge status={slot.status} />
        {!done && <Feather name="chevron-right" size={20} color={c.mutedForeground} />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  lock: {
    width: 64,
    height: 64,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginTitle: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  loginSub: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  hello: { fontSize: 13, fontFamily: 'Inter_500Medium', marginBottom: 6 },
  pendingCard: { borderWidth: 1, padding: 14, gap: 10, marginBottom: 4 },
  pendingTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', flex: 1 },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  gameRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderWidth: 1 },
  slotTime: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  gameName: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  gameMeta: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
});
