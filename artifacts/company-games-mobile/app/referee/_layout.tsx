import React from 'react';
import { Stack } from 'expo-router';
import colors from '@/constants/colors';

const theme = colors.dark;

export default function RefereeLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.foreground,
        headerTitleStyle: { fontFamily: 'Inter_600SemiBold' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Schiedsrichter' }} />
      <Stack.Screen name="checkin" options={{ title: 'Team Check-in' }} />
      <Stack.Screen name="eingabe" options={{ title: 'Ergebnis erfassen' }} />
      <Stack.Screen name="bestaetigung" options={{ title: 'Bestätigt', headerBackVisible: false }} />
    </Stack>
  );
}
