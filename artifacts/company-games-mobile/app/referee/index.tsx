import React, { useLayoutEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FlatList } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useListGames, type Game } from '@workspace/api-client-react';
import { Button, Card, EmptyState, ErrorState, Loading, TextField } from '@/components/ui';

export default function RefereeHome() {
  const { isReferee, isLoading } = useAuth();
  if (isLoading) return <Loading />;
  return isReferee ? <GamesList /> : <LoginForm />;
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

function GamesList() {
  const c = useColors();
  const router = useRouter();
  const navigation = useNavigation();
  const { user, signOut } = useAuth();
  const { data, isLoading, isError, error, refetch } = useListGames();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={signOut} hitSlop={10} testID="logout">
          <Feather name="log-out" size={20} color={c.mutedForeground} />
        </Pressable>
      ),
    });
  }, [navigation, signOut, c.mutedForeground]);

  if (isLoading) return <Loading label="Lade Games…" />;
  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : 'Games konnten nicht geladen werden'}
        onRetry={() => refetch()}
      />
    );
  }

  const games = data ?? [];

  return (
    <FlatList
      data={games}
      keyExtractor={(g) => g.id}
      scrollEnabled={games.length > 0}
      style={{ backgroundColor: c.background }}
      contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
      ListHeaderComponent={
        <Text style={[styles.hello, { color: c.mutedForeground }]}>
          Hallo {user?.name} · Wähle ein Game
        </Text>
      }
      renderItem={({ item }) => <GameRow game={item} onPress={() => openGame(router, item)} />}
      ListEmptyComponent={
        <EmptyState icon="clipboard" title="Keine Games" subtitle="Es sind noch keine Games angelegt." />
      }
    />
  );
}

function openGame(router: ReturnType<typeof useRouter>, game: Game) {
  router.push({
    pathname: '/referee/checkin',
    params: { gameId: game.id, slug: game.slug, gameName: game.name },
  });
}

function GameRow({ game, onPress }: { game: Game; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      testID={`game-${game.slug}`}
      style={({ pressed }) => [
        styles.gameRow,
        { backgroundColor: c.card, borderColor: c.border, borderRadius: c.radius, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.gameName, { color: c.foreground }]}>{game.name}</Text>
        {!!game.status && (
          <Text style={[styles.gameMeta, { color: c.mutedForeground }]}>{game.status}</Text>
        )}
      </View>
      <Feather name="chevron-right" size={22} color={c.mutedForeground} />
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
  gameRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderWidth: 1 },
  gameName: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  gameMeta: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
});
