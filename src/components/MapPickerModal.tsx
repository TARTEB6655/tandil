import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import MapView, { Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../constants';
import { getAddressFromCoordinates } from '../utils/addressFromLocation';
import type { AddressFromLocation } from '../utils/addressFromLocation';

const DEFAULT_REGION: Region = {
  latitude: 25.2048,
  longitude: 55.2708,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

interface MapPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (address: AddressFromLocation, coords?: { latitude: number; longitude: number }) => void;
  loadingMessage?: string;
  confirmMessage?: string;
}

export default function MapPickerModal({
  visible,
  onClose,
  onSelect,
  loadingMessage = 'Loading map…',
  confirmMessage = 'Use this location',
}: MapPickerModalProps) {
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [mapReady, setMapReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (status !== 'granted') {
          setRegion(DEFAULT_REGION);
          setLoading(false);
          return;
        }
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        setRegion({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      } catch {
        if (!cancelled) setRegion(DEFAULT_REGION);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [visible]);

  const handleRegionChangeComplete = (r: Region) => {
    setRegion(r);
    setMapReady(true);
  };

  const handleUseThisLocation = async () => {
    setConfirming(true);
    try {
      const result = await getAddressFromCoordinates(region.latitude, region.longitude);
      if (result.ok) {
        onSelect(result.address, {
          latitude: region.latitude,
          longitude: region.longitude,
        });
        onClose();
      } else {
        Alert.alert('Error', result.error);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not get address for this location');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.title}>Pick location from map</Text>
            <View style={styles.closeBtn} />
          </View>
          <View style={styles.mapWrap}>
            {loading ? (
              <View style={styles.loadingMap}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>{loadingMessage}</Text>
              </View>
            ) : (
              <MapView
                style={styles.map}
                initialRegion={region}
                onRegionChangeComplete={handleRegionChangeComplete}
                showsUserLocation
                showsMyLocationButton={Platform.OS !== 'web'}
              />
            )}
            {!loading && (
              <View style={styles.markerFixed} pointerEvents="none">
                <Ionicons name="location" size={40} color={COLORS.primary} />
              </View>
            )}
          </View>
          <View style={styles.footer}>
            <Text style={styles.hint}>Move the map to choose a different address</Text>
            <TouchableOpacity
              style={[styles.confirmBtn, confirming && styles.confirmBtnDisabled]}
              onPress={handleUseThisLocation}
              disabled={confirming}
            >
              {confirming ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.confirmBtnText}>{confirmMessage}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: BORDER_RADIUS.lg,
    borderTopRightRadius: BORDER_RADIUS.lg,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  closeBtn: { width: 40, alignItems: 'center' },
  title: { fontSize: FONT_SIZES.lg, fontWeight: FONT_WEIGHTS.bold, color: COLORS.text },
  mapWrap: {
    height: 320,
    position: 'relative',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  loadingMap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  loadingText: { marginTop: SPACING.sm, fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  markerFixed: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -20,
    marginTop: -40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl + (Platform.OS === 'ios' ? 20 : 0),
  },
  hint: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  confirmBtnDisabled: { opacity: 0.7 },
  confirmBtnText: { color: '#fff', fontWeight: FONT_WEIGHTS.semiBold, fontSize: FONT_SIZES.md },
});
