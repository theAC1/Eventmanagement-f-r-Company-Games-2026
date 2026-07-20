import React from 'react';
import { Platform, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { FlatList } from 'react-native';
import { useColors } from '@/hooks/useColors';
import {
  getGetRanglisteQueryKey,
  useGetRangliste,
  type RanglisteEntry,
} from '@workspace/api-client-react';
import { EmptyState, ErrorState, Loading } from '@/components/ui';

export default function ScoreboardScreen() {
  const c = useColors();
  const { data, isLoading, isError, error, refetch, isRefetching, dataUpdatedAt } =
    useGetRangliste({
      query: { queryKey: getGetRanglisteQueryKey(), refetchInterval: 10_000 },
    });

  if (isLoading) return <Loading label="Lade Rangliste…" />;
  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : 'Verbindung verloren'}
        onRetry={() => refetch()}
      />
    );
  }

  const rangliste = data?.rangliste ?? [];
  const totalCells = (data?.totalGames ?? 0) * (data?.totalTeams ?? 0);
  const done = data?.ergebnisseEingetragen ?? 0;
  const progressPct = totalCells > 0 ? Math.round((done / totalCells) * 100) : 0;
  const updated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={[styles.statusBar, { borderBottomColor: c.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.statusText, { color: c.mutedForeground }]}>
            {done}/{totalCells} Ergebnisse · {progressPct}%
          </Text>
          <View style={[styles.track, { backgroundColor: c.accent }]}>
            <View
              style={[styles.fill, { backgroundColor: c.primary, width: `${progressPct}%` }]}
            />
          </View>
        </View>
        {!!updated && (
          <View style={styles.liveWrap}>
            <View style={[styles.dot, { backgroundColor: c.primary }]} />
            <Text style={[styles.statusText, { color: c.mutedForeground }]}>{updated}</Text>
          </View>
        )}
      </View>

      <FlatList
        data={rangliste}
        keyExtractor={(item) => item.teamId}
        scrollEnabled={rangliste.length > 0}
        contentContainerStyle={{
          padding: 16,
          gap: 8,
          paddingBottom: Platform.OS === 'web' ? 34 + 16 : 24,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={c.mutedForeground}
          />
        }
        renderItem={({ item, index }) => <Row entry={item} index={index} />}
        ListEmptyComponent={
          <EmptyState
            icon="bar-chart-2"
            title="Noch keine Ergebnisse"
            subtitle="Sobald Schiedsrichter Ergebnisse erfassen, erscheinen sie hier."
          />
        }
      />
    </View>
  );
}

function Row({ entry, index }: { entry: RanglisteEntry; index: number }) {
  const c = useColors();
  const isTop3 = index < 3;
  const medal = [c.gold, c.silver, c.bronze][index];

  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: c.card,
          borderColor: isTop3 ? medal : c.border,
          borderRadius: c.radius,
        },
      ]}
    >
      <Text
        style={[
          styles.rank,
          { color: isTop3 ? medal : c.mutedForeground, fontSize: isTop3 ? 24 : 18 },
        ]}
      >
        {entry.gesamtRang}
      </Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.team, { color: c.foreground }]} numberOfLines={1}>
          {entry.teamName}
        </Text>
        <Text style={[styles.games, { color: c.mutedForeground }]}>
          {entry.gamesGespielt}/{entry.gamesTotal} Games
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.points, { color: c.foreground }]}>{entry.rangPunkteSumme}</Text>
        <Text style={[styles.pointsLabel, { color: c.mutedForeground }]}>Punkte</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  statusText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  track: { height: 5, borderRadius: 999, marginTop: 6, overflow: 'hidden' },
  fill: { height: 5, borderRadius: 999 },
  liveWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderWidth: 1,
  },
  rank: {
    fontFamily: 'Inter_700Bold',
    width: 34,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  team: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  games: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  points: { fontSize: 20, fontFamily: 'Inter_700Bold', fontVariant: ['tabular-nums'] },
  pointsLabel: { fontSize: 11, fontFamily: 'Inter_400Regular' },
});
