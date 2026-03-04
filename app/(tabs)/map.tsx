import { Ionicons } from '@expo/vector-icons';
import { GlassView } from 'expo-glass-effect';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Callout, Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGeofence } from '../../hooks/useGeofence';
import { useNotes } from '../../hooks/useNotes';
import { useTheme } from '../../hooks/useTheme';

const { width } = Dimensions.get('window');

export default function MapScreen() {
    const { t } = useTranslation();
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const { notes, loading } = useNotes();
    const { location } = useGeofence();
    const router = useRouter();
    const mapRef = useRef<MapView>(null);

    const goToMyLocation = async () => {
        let currentLoc = location;
        if (!currentLoc) {
            try {
                currentLoc = await Location.getCurrentPositionAsync({});
            } catch (error) {
                console.warn('Could not get current location:', error);
            }
        }

        if (currentLoc) {
            mapRef.current?.animateToRegion({
                latitude: currentLoc.coords.latitude,
                longitude: currentLoc.coords.longitude,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
            }, 1000);
        }
    };

    const initialRegion = location
        ? {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
        }
        : {
            latitude: 10.762622,  // Default: Ho Chi Minh City
            longitude: 106.660172,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
        };

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
                            onPress={() => router.push(`/note/${note.id}` as any)}
                            tooltip={false}
                        >
                            <GlassView style={styles.callout}
                                glassEffectStyle="regular"
                                colorScheme={isDark ? 'dark' : 'light'}>
                                <Text style={styles.calloutTitle} numberOfLines={1}>
                                    🍜 {note.locationName || t('map.unknownLocation', 'Unknown')}
                                </Text>
                                <Text style={styles.calloutLocation} numberOfLines={2}>
                                    {note.type === 'text'
                                        ? note.content.substring(0, 80) + (note.content.length > 80 ? '…' : '')
                                        : '📷 ' + t('map.photoNote', 'Photo Note')}
                                </Text>
                                <Text style={styles.calloutHint}>{t('map.tapToOpen', 'Tap to open →')}</Text>
                            </GlassView>
                        </Callout>
                    </Marker>
                ))}
            </MapView>

            {/* Note count overlay */}
            <GlassView
                style={[styles.countBadge, { top: insets.top + 8 }]}
                glassEffectStyle="regular"
                colorScheme={isDark ? 'dark' : 'light'}
            >
                <Ionicons name="pin" size={16} color={colors.primary} />
                <Text style={[styles.countText, { color: colors.text }]}>
                    {notes.length} {notes.length === 1 ? t('map.note', 'note') : t('map.notes', 'notes')}
                </Text>
            </GlassView>

            {/* Location FAB */}
            <Pressable style={[styles.fabContainer, { top: insets.top + 8 }]} onPress={goToMyLocation}>
                <GlassView
                    style={styles.fab}
                    glassEffectStyle="regular"
                    colorScheme={isDark ? 'dark' : 'light'}
                >
                    <Ionicons name="location" size={22} color={colors.primary} />
                </GlassView>
            </Pressable>

            {/* Empty state overlay */}
            {notes.length === 0 && (
                <View style={styles.emptyOverlay} pointerEvents="none">
                    <View style={[styles.emptyCard, { backgroundColor: isDark ? 'rgba(28,28,30,0.9)' : 'rgba(255,255,255,0.92)' }]}>
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
        color: '#1C1C1E',
        marginBottom: 4,
    },
    calloutLocation: {
        fontSize: 13,
        color: '#8E8E93',
        marginBottom: 6,
    },
    calloutHint: {
        fontSize: 12,
        color: '#FF9F0A',
        fontWeight: '600',
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
    },
    emptySubtitle: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
});
