import { Ionicons } from '@expo/vector-icons';
import { GlassView } from 'expo-glass-effect';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import InfoPill from '../../components/ui/InfoPill';
import { useGeofence } from '../../hooks/useGeofence';
import { useNoteDetailSheet } from '../../hooks/useNoteDetailSheet';
import { useNotesStore } from '../../hooks/useNotes';
import { Note } from '../../services/database';
import { useTheme } from '../../hooks/useTheme';
import { isOlderIOS } from '../../utils/platform';

const DEFAULT_REGION: Region = {
    latitude: 10.762622,
    longitude: 106.660172,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
};

const GROUP_PRECISION = 4; // ~11m at the equator. Helps avoid overlapping-pin tap jitter.

interface MarkerGroup {
    id: string;
    latitude: number;
    longitude: number;
    notes: Note[];
}

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
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [selectedNoteIndex, setSelectedNoteIndex] = useState(0);
    const hasCenteredRef = useRef(false);
    const lastMarkerTapAtRef = useRef(0);

    const markerGroups = useMemo<MarkerGroup[]>(() => {
        const groupedNotes = new Map<string, Note[]>();

        notes.forEach((note) => {
            const key = `${note.latitude.toFixed(GROUP_PRECISION)}:${note.longitude.toFixed(GROUP_PRECISION)}`;
            const bucket = groupedNotes.get(key);
            if (bucket) {
                bucket.push(note);
            } else {
                groupedNotes.set(key, [note]);
            }
        });

        return Array.from(groupedNotes.entries()).map(([id, grouped]) => {
            const latitude = grouped.reduce((sum, note) => sum + note.latitude, 0) / grouped.length;
            const longitude = grouped.reduce((sum, note) => sum + note.longitude, 0) / grouped.length;
            const sortedNotes = [...grouped].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

            return {
                id,
                latitude,
                longitude,
                notes: sortedNotes,
            };
        });
    }, [notes]);

    const selectedGroup = useMemo(
        () => markerGroups.find((group) => group.id === selectedGroupId) ?? null,
        [markerGroups, selectedGroupId]
    );
    const selectedNote = selectedGroup?.notes[selectedNoteIndex] ?? null;

    useEffect(() => {
        if (!selectedGroup) {
            setSelectedNoteIndex(0);
            return;
        }

        if (selectedNoteIndex > selectedGroup.notes.length - 1) {
            setSelectedNoteIndex(0);
        }
    }, [selectedGroup, selectedNoteIndex]);

    useEffect(() => {
        if (!selectedGroupId) {
            return;
        }
        const stillExists = markerGroups.some((group) => group.id === selectedGroupId);
        if (!stillExists) {
            setSelectedGroupId(null);
        }
    }, [markerGroups, selectedGroupId]);

    const openNote = useCallback(
        (noteId: string) => {
            if (Platform.OS === 'ios') {
                openNoteDetail(noteId);
                return;
            }
            router.push(`/note/${noteId}` as any);
        },
        [openNoteDetail, router]
    );

    const handleOpenSelectedNote = useCallback(() => {
        if (!selectedNote) {
            return;
        }
        openNote(selectedNote.id);
    }, [openNote, selectedNote]);

    const handleSelectGroup = useCallback((groupId: string) => {
        lastMarkerTapAtRef.current = Date.now();
        setSelectedGroupId(groupId);
        setSelectedNoteIndex(0);
    }, []);

    const handleMapPress = useCallback(() => {
        if (Date.now() - lastMarkerTapAtRef.current < 250) {
            return;
        }
        setSelectedGroupId(null);
    }, []);

    const handleOpenPrevInGroup = useCallback(() => {
        if (!selectedGroup) {
            return;
        }
        setSelectedNoteIndex((current) => (current - 1 + selectedGroup.notes.length) % selectedGroup.notes.length);
    }, [selectedGroup]);

    const handleOpenNextInGroup = useCallback(() => {
        if (!selectedGroup) {
            return;
        }
        setSelectedNoteIndex((current) => (current + 1) % selectedGroup.notes.length);
    }, [selectedGroup]);

    const selectedNotePreview = useMemo(() => {
        if (!selectedNote) {
            return '';
        }
        if (selectedNote.type === 'photo') {
            return `📷 ${t('map.photoNote', 'Photo Note')}`;
        }

        return selectedNote.content.substring(0, 100) + (selectedNote.content.length > 100 ? '…' : '');
    }, [selectedNote, t]);

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
                onPress={handleMapPress}
                onMapReady={() => {
                    setIsMapReady(true);
                }}
                showsUserLocation
                showsMyLocationButton
                userInterfaceStyle={isDark ? 'dark' : 'light'}
            >
                {markerGroups.map((group) => (
                    <Marker
                        key={group.id}
                        coordinate={{
                            latitude: group.latitude,
                            longitude: group.longitude,
                        }}
                        pinColor={group.notes[0]?.type === 'photo' ? '#FF6B6B' : colors.primary}
                        tracksViewChanges={false}
                        onPress={(event) => {
                            event.stopPropagation?.();
                            handleSelectGroup(group.id);
                        }}
                        onSelect={() => {
                            handleSelectGroup(group.id);
                        }}
                    >
                        {group.notes.length > 1 ? (
                            <View style={[styles.groupMarker, { backgroundColor: colors.primary }]}>
                                <Text style={styles.groupMarkerText}>{group.notes.length}</Text>
                            </View>
                        ) : null}
                    </Marker>
                ))}
            </MapView>

            {selectedNote ? (
                <View style={[styles.popupContainer, { bottom: 96 + insets.bottom }]} pointerEvents="box-none">
                    <View
                        style={[
                            styles.popupCard,
                            {
                                backgroundColor: isDark ? 'rgba(20,20,22,0.92)' : 'rgba(255,255,255,0.96)',
                                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                            },
                        ]}
                    >
                        <Text style={[styles.popupTitle, { color: colors.text }]} numberOfLines={1}>
                            {selectedNote.locationName || t('map.unknownLocation', 'Unknown')}
                        </Text>
                        <Text style={[styles.popupContent, { color: colors.secondaryText }]} numberOfLines={2}>
                            {selectedNotePreview}
                        </Text>

                        <View style={styles.popupFooter}>
                            {selectedGroup && selectedGroup.notes.length > 1 ? (
                                <View style={styles.popupPager}>
                                    <Pressable style={styles.popupPagerBtn} onPress={handleOpenPrevInGroup}>
                                        <Ionicons name="chevron-back" size={14} color={colors.text} />
                                    </Pressable>
                                    <Text style={[styles.popupPagerText, { color: colors.secondaryText }]}>
                                        {selectedNoteIndex + 1}/{selectedGroup.notes.length}
                                    </Text>
                                    <Pressable style={styles.popupPagerBtn} onPress={handleOpenNextInGroup}>
                                        <Ionicons name="chevron-forward" size={14} color={colors.text} />
                                    </Pressable>
                                </View>
                            ) : (
                                <Text style={[styles.popupGroupText, { color: colors.secondaryText }]}>
                                    {t('map.singleNote', 'Pinned note')}
                                </Text>
                            )}

                            <Pressable
                                style={[styles.popupActionBtn, { backgroundColor: `${colors.primary}20` }]}
                                onPress={handleOpenSelectedNote}
                            >
                                <Text style={[styles.popupActionText, { color: colors.primary }]}>
                                    {t('map.openNote', 'Open note')}
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            ) : null}

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
    groupMarker: {
        minWidth: 34,
        height: 34,
        borderRadius: 17,
        paddingHorizontal: 8,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'white',
    },
    groupMarkerText: {
        color: 'white',
        fontSize: 13,
        fontWeight: '800',
        fontFamily: 'System',
    },
    popupContainer: {
        position: 'absolute',
        left: 16,
        right: 16,
    },
    popupCard: {
        borderRadius: 20,
        borderWidth: 1,
        padding: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 18,
        elevation: 10,
    },
    popupTitle: {
        fontSize: 18,
        fontWeight: '800',
        marginBottom: 4,
        fontFamily: 'System',
    },
    popupContent: {
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 10,
        fontFamily: 'System',
    },
    popupFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 10,
    },
    popupPager: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    popupPagerBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    popupPagerText: {
        fontSize: 13,
        fontWeight: '600',
        minWidth: 38,
        textAlign: 'center',
        fontFamily: 'System',
    },
    popupGroupText: {
        fontSize: 13,
        fontWeight: '500',
        fontFamily: 'System',
    },
    popupActionBtn: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
    },
    popupActionText: {
        fontSize: 14,
        fontWeight: '700',
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
