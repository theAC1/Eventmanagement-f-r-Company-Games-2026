import React, { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { Button } from '@/components/ui';

/**
 * QR scanner that reads a scanned string and reports it via onScan.
 * Falls back gracefully when the camera is unavailable (web / denied
 * permission) — the parent screen always offers manual code entry too.
 */
export function QRScanner({
  onScan,
  active = true,
}: {
  onScan: (value: string) => void;
  active?: boolean;
}) {
  const c = useColors();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  // Camera scanning is not reliable on web — direct the user to manual entry.
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.fallback, { borderColor: c.border, borderRadius: c.radius }]}>
        <Feather name="smartphone" size={32} color={c.mutedForeground} />
        <Text style={[styles.fallbackText, { color: c.mutedForeground }]}>
          QR-Scan ist nur in der mobilen App verfügbar. Bitte Code manuell eingeben.
        </Text>
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={[styles.fallback, { borderColor: c.border, borderRadius: c.radius }]}>
        <Text style={[styles.fallbackText, { color: c.mutedForeground }]}>Kamera wird geladen…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.fallback, { borderColor: c.border, borderRadius: c.radius }]}>
        <Feather name="camera-off" size={32} color={c.mutedForeground} />
        <Text style={[styles.fallbackText, { color: c.mutedForeground }]}>
          Kamerazugriff wird zum Scannen benötigt.
        </Text>
        <Button label="Kamera erlauben" icon="camera" onPress={requestPermission} />
      </View>
    );
  }

  return (
    <View style={[styles.cameraWrap, { borderRadius: c.radius }]}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={
          active && !scanned
            ? ({ data }) => {
                setScanned(true);
                onScan(data);
                // Allow re-scanning shortly after in case the value was rejected.
                setTimeout(() => setScanned(false), 2500);
              }
            : undefined
        }
      />
      <View style={styles.reticle} pointerEvents="none">
        <View style={[styles.reticleBox, { borderColor: c.primary }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cameraWrap: {
    width: '100%',
    aspectRatio: 1,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  reticle: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticleBox: {
    width: '65%',
    aspectRatio: 1,
    borderWidth: 3,
    borderRadius: 24,
  },
  fallback: {
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: 28,
    alignItems: 'center',
    gap: 12,
  },
  fallbackText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
  },
});
