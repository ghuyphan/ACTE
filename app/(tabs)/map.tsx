import { Ionicons } from '@expo/vector-icons';
import { GlassView } from 'expo-glass-effect';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Callout, Marker, Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import InfoPill from '../../components/ui/InfoPill';
import { useGeofence } from '../../hooks/useGeofence';
import { useNoteDetailSheet } from '../../hooks/useNoteDetailSheet';
import { useNotesStore } from '../../hooks/useNotes';
import { useTheme } from '../../hooks/useTheme';
import { isOlderIOS } from '../../utils/platform';

const DEFAULT_REGION: Region = {
    latitude: 10.762622,
    longitude: 106.660172,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
};

export default function MapScreen() {
    const { t } = useTranslation();
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const { notes, loading } = useNotesStore();
    const { location, requestForegroundLocation, openAppSettings } = useGeofence();
    const { openNoteDetail } = useNoteDetailSheet();
    const router = useRouter();
    const mapRef = useRef<MapView>(null);
    const [isMapReady, setIsMapReady] = useState(false);
    const hasCenteredRef = useRef(false);

    const initialRegion = useMemo<Region>(() => {
        if (location) {
            return {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
            };
        }

        if (notes.length > 0) {
            return {
                latitude: notes[0].latitude,
                longitude: notes[0].longitude,
                latitudeDelta: 0.035,
                longitudeDelta: 0.035,
            };
        }

        return DEFAULT_REGION;
    }, [location, notes]);

    const goToMyLocation = async () => {
        let target = location;
        if (!target) {
            const result = await requestForegroundLocation();
            target = result.location;
            if (!target && result.requiresSettings) {
                await openAppSettings();
                return;
            }
        }

        if (target) {
            mapRef.current?.animateToRegion({
                latitude: target.coords.latitude,
                longitude: target.coords.longitude,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
            }, 1000);
        }
    };

    useEffect(() => {
        if (!isMapReady || hasCenteredRef.current || !mapRef.current) {
            return;
        }

        if (location) {
            mapRef.current.animateToRegion(
                {
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    latitudeDelta: 0.02,
                    longitudeDelta: 0.02,
                },
                900
            );
            hasCenteredRef.current = true;
            return;
        }

        if (notes.length > 1) {
            mapRef.current.fitToCoordinates(
                notes.map((note) => ({
                    latitude: note.latitude,
                    longitude: note.longitude,
                })),
                {
                    edgePadding: { top: 120, right: 80, bottom: 160, left: 80 },
                    animated: true,
                }
            );
            hasCenteredRef.current = true;
            return;
        }

        if (notes.length === 1) {
            mapRef.current.animateToRegion(
                {
                    latitude: notes[0].latitude,
                    longitude: notes[0].longitude,
                    latitudeDelta: 0.025,
                    longitudeDelta: 0.025,
                },
                900
            );
            hasCenteredRef.current = true;
            return;
        }

        mapRef.current.animateToRegion(DEFAULT_REGION, 900);
        hasCenteredRef.current = true;
    }, [isMapReady, location, notes]);

    if (loading) {
        return (
            <View style={[styles.center, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={initialRegion}
                onMapReady={() => {
                    setIsMapReady(true);
                }}
                showsUserLocation
                showsMyLocationButton
                userInterfaceStyle={isDark ? 'dark' : 'light'}
            >
                {notes.map((note) => (
                    <Marker
                        key={note.id}
                        coordinate={{
                            latitude: note.latitude,
                            longitude: note.longitude,
                        }}
                        pinColor={note.type === 'photo' ? '#FF6B6B' : colors.primary}
                    >
                        <Callout
                            onPress={() => {
                                if (Platform.OS === 'ios') {
                                    openNoteDetail(note.id);
                                    return;
                                }
                                router.push(`/note/${note.id}` as any);
                            }}
                            tooltip={false}
                        >
                            <View style={styles.callout}>
                                <Text style={styles.calloutTitle} numberOfLines={1}>
                                    🍜 {note.locationName || t('map.unknownLocation', 'Unknown')}
                                </Text>
                                <Text style={styles.calloutLocation} numberOfLines={2}>
                                    {note.type === 'text'
                                        ? note.content.substring(0, 80) + (note.content.length > 80 ? '…' : '')
                                        : '📷 ' + t('map.photoNote', 'Photo Note')}
                                </Text>
                                <Text style={styles.calloutHint}>{t('map.tapToOpen', 'Tap to open →')}</Text>
                            </View>
                        </Callout>
                    </Marker>
                ))}
            </MapView>

            <InfoPill icon="pin" iconColor={colors.primary} style={[styles.countBadge, { top: insets.top + 8 }]}>
                <Text style={[styles.countText, { color: colors.text }]}>
                    {notes.length} {notes.length === 1 ? t('map.note', 'note') : t('map.notes', 'notes')}
                </Text>
            </InfoPill>

            {/* Location FAB */}
            <Pressable style={[styles.fabContainer, { top: insets.top + 8 }]} onPress={goToMyLocation}>
                <GlassView
                    style={styles.fab}
                    glassEffectStyle="regular"
                    colorScheme={isDark ? 'dark' : 'light'}
                >
                    {isOlderIOS && <View style={[StyleSheet.absoluteFillObject, { backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.85)' }]} />}
                    <Ionicons name="location" size={22} color={colors.primary} />
                </GlassView>
            </Pressable>

            {/* Empty state overlay */}
            {notes.length === 0 && (
                <View style={styles.emptyOverlay} pointerEvents="none">
                    <View style={[styles.emptyCard, { overflow: 'hidden' }]}>
                        <Ionicons name="map-outline" size={40} color={colors.primary} style={{ marginBottom: 8 }} />
                        <Text style={[styles.emptyTitle, { color: colors.text }]}>
                            {t('map.emptyTitle', 'No notes on the map yet')}
                        </Text>
                        <Text style={[styles.emptySubtitle, { color: colors.secondaryText }]}>
                            {t('map.emptySubtitle', 'Your saved notes will appear as pins here')}
                        </Text>
                    </View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    map: {
        width: '100%',
        height: '100%',
    },
    callout: {
        width: 220,
        padding: 12,
    },
    calloutTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1C1C1E', // Callouts are always light themed natively, so keeping slightly dark text
        marginBottom: 4,
        fontFamily: 'System',
    },
    calloutLocation: {
        fontSize: 13,
        color: '#8E8E93',
        marginBottom: 6,
        fontFamily: 'System',
    },
    calloutHint: {
        fontSize: 12,
        color: '#FF9F0A', // Keep this or use colors.primary
        fontWeight: '600',
        fontFamily: 'System',
    },
    countBadge: {
        position: 'absolute',
        top: 64,
        left: 20,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 20,
        gap: 6,
        overflow: 'hidden',
    },
    countText: {
        fontSize: 15,
        fontWeight: '600',
        fontFamily: 'System',
    },
    fabContainer: {
        position: 'absolute',
        right: 20,
        zIndex: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 5,
    },
    fab: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    // ─── Empty state ──────────────────────
    emptyOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyCard: {
        paddingHorizontal: 32,
        paddingVertical: 28,
        borderRadius: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 8,
        maxWidth: 280,
    },
    emptyTitle: {
        fontSize: 17,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 6,
        fontFamily: 'System',
    },
    emptySubtitle: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
        fontFamily: 'System',
    },
});
