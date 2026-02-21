import { Bus, Footprints, MapPin } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BuildingRecord } from '../constants/buildings';
import { getNearestStop, STOPS } from '../utils/locationLogic';
import { fetchOsrmRoute, RoutePoint } from '../utils/osrmDirections';
import { calculateArrivalTime, Campus, getShuttleInfo, ShuttleInfo } from '../utils/shuttleLogic';

interface ShuttleDirectionsProps {
    origin: RoutePoint | null;
    destination: BuildingRecord | null;
}

const ShuttleDirections: React.FC<ShuttleDirectionsProps> = ({ origin, destination }) => {
    const [shuttleInfo, setShuttleInfo] = useState<ShuttleInfo | null>(null);
    const [nearestStop, setNearestStop] = useState<{ stop: Campus; destination: Campus } | null>(null);
    const [countdown, setCountdown] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const [walkToStopMinutes, setWalkToStopMinutes] = useState<number | null>(null);
    const [walkFromStopMinutes, setWalkFromStopMinutes] = useState<number | null>(null);

    const [selectedDeparture, setSelectedDeparture] = useState<string | null>(null);

    useEffect(() => {
        if (!origin || !destination) {
            setLoading(false);
            return;
        }

        (async () => {
            try {
                const nearest = getNearestStop(origin);
                setNearestStop(nearest);

                // Calculate walk to first stop
                const stopCoords = STOPS[nearest.stop];
                const walkTo = await fetchOsrmRoute(origin, stopCoords, 'walking');
                setWalkToStopMinutes(Math.round(walkTo.durationSeconds / 60));

                // Calculate walk from second stop to destination
                const destStopCoords = STOPS[nearest.destination];
                const walkFrom = await fetchOsrmRoute(destStopCoords, {
                    latitude: destination.latitude,
                    longitude: destination.longitude
                }, 'walking');
                setWalkFromStopMinutes(Math.round(walkFrom.durationSeconds / 60));

                setLoading(false);
            } catch (err) {
                console.error('Error fetching walking routes:', err);
                setErrorMsg('Failed to fetch some directions.');
                setLoading(false);
            }
        })();
    }, [origin, destination]);

    useEffect(() => {
        if (!nearestStop) return;

        const updateShuttleData = () => {
            const now = new Date();
            const info = getShuttleInfo(nearestStop.stop, now);
            setShuttleInfo(info);

            // Auto-select the next departure if none selected or if selected is in the past
            if (!selectedDeparture || (info.nextDeparture && selectedDeparture < info.nextDeparture)) {
                setSelectedDeparture(info.nextDeparture);
            }

            const activeDeparture = selectedDeparture || info.nextDeparture;

            if (activeDeparture) {
                const [targetH, targetM] = activeDeparture.split(':').map(Number);
                const targetTime = new Date(now);
                targetTime.setHours(targetH, targetM, 0, 0);

                const diff = targetTime.getTime() - now.getTime();
                if (diff > 0) {
                    const hours = Math.floor(diff / (1000 * 60 * 60));
                    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                    setCountdown(`${hours > 0 ? hours + 'h ' : ''}${minutes}m ${seconds}s`);
                } else {
                    setCountdown('Departing...');
                }
            } else {
                setCountdown('');
            }
        };

        updateShuttleData();
        const interval = setInterval(updateShuttleData, 1000);
        return () => clearInterval(interval);
    }, [nearestStop, selectedDeparture]);

    const currentArrival = selectedDeparture ? calculateArrivalTime(selectedDeparture) : shuttleInfo?.estimatedArrival;

    if (loading) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color="#912338" />
                <Text style={styles.loadingText}>Planning your journey...</Text>
            </View>
        );
    }

    if (errorMsg) {
        return (
            <View style={styles.container}>
                <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
        );
    }

    if(shuttleInfo?.serviceUnavailable) return(
        <View style={styles.card}>

            <View style={styles.timelineItem}>
                <View style={styles.timelineLeft}>
                    <View style={[styles.timelineIcon, styles.iconShuttle]}>
                        <Bus size={16} color="white" />
                    </View>
                </View>
                <View style={styles.timelineRight}>
                    <View style={styles.shuttleHeader}>
                        <Text style={styles.timelineTitle}>Concordia Shuttle</Text>
                    </View>

                    <Text style={styles.unavailableText}>{shuttleInfo.message}</Text>
                    
                </View>
            </View>
        </View>
    );
    return (
        <View style={styles.card}>
            {/* SEGMENT 1: Walk to Stop */}
            <View style={styles.timelineItem}>
                <View style={styles.timelineLeft}>
                    <View style={[styles.timelineIcon, styles.iconWalk]}>
                        <Footprints size={16} color="white" />
                    </View>
                    <View style={styles.timelineLine} />
                </View>
                <View style={styles.timelineRight}>
                    <Text style={styles.timelineTitle}>Walk to Shuttle Stop</Text>
                    <Text style={styles.timelineSub}>{walkToStopMinutes} min • {nearestStop?.stop} Campus Stop</Text>
                </View>
            </View>

            {/* SEGMENT 2: Shuttle Leg */}
            <View style={styles.timelineItem}>
                <View style={styles.timelineLeft}>
                    <View style={[styles.timelineIcon, styles.iconShuttle]}>
                        <Bus size={16} color="white" />
                    </View>
                    <View style={styles.timelineLine} />
                </View>
                <View style={styles.timelineRight}>
                    <View style={styles.shuttleHeader}>
                        <Text style={styles.timelineTitle}>Concordia Shuttle</Text>
                        {!shuttleInfo?.serviceUnavailable && (
                            <View style={styles.liveBadge}>
                                <Text style={styles.liveText}>LIVE</Text>
                            </View>
                        )}
                    </View>

                    {shuttleInfo?.serviceUnavailable ? (
                        <Text style={styles.unavailableText}>{shuttleInfo.message}</Text>
                    ) : (
                        <>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.departureList}>
                                {shuttleInfo?.nextThreeDepartures.map((time) => (
                                    <TouchableOpacity
                                        key={time}
                                        onPress={() => setSelectedDeparture(time)}
                                        style={[
                                            styles.departureCapsule,
                                            selectedDeparture === time && styles.selectedCapsule
                                        ]}
                                    >
                                        <Text style={[
                                            styles.departureText,
                                            selectedDeparture === time && styles.selectedText
                                        ]}>
                                            {time}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            <View style={styles.shuttleStatusCard}>
                                <View style={styles.statusRow}>
                                    <View>
                                        <Text style={styles.statusLabel}>Departure</Text>
                                        <Text style={styles.statusValue}>{selectedDeparture}</Text>
                                    </View>
                                    <View style={styles.divider} />
                                    <View style={styles.countdownBox}>
                                        <Text style={styles.countdownLabel}>Leaving in</Text>
                                        <Text style={styles.countdownValue}>{countdown}</Text>
                                    </View>
                                </View>
                                <View style={styles.arrivalBox}>
                                    <Text style={styles.statusLabel}>Est. Arrival at {nearestStop?.destination}</Text>
                                    <Text style={styles.arrivalValue}>{currentArrival}</Text>
                                </View>
                            </View>
                        </>
                    )}
                </View>
            </View>

            {/* SEGMENT 3: Walk to Destination */}
            <View style={styles.timelineItem}>
                <View style={styles.timelineLeft}>
                    <View style={styles.timelineIconDest}>
                        <MapPin size={16} color="#912338" />
                    </View>
                </View>
                <View style={styles.timelineRight}>
                    <Text style={styles.timelineTitle}>{destination?.shortName || 'Destination'}</Text>
                    <Text style={styles.timelineSub}>{walkFromStopMinutes} min Walk</Text>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    card: {
        padding: 4,
        marginTop: 10,
    },
    timelineItem: {
        flexDirection: 'row',
    },
    timelineLeft: {
        width: 30,
        alignItems: 'center',
    },
    timelineIcon: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1,
    },
    iconWalk: {
        backgroundColor: '#4CAF50',
    },
    iconShuttle: {
        backgroundColor: '#912338',
    },
    timelineIconDest: {
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: '#912338',
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1,
    },
    timelineLine: {
        width: 2,
        flex: 1,
        backgroundColor: '#E0E0E0',
        marginVertical: -2,
    },
    timelineRight: {
        flex: 1,
        marginLeft: 12,
        paddingBottom: 20,
    },
    timelineTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#333',
    },
    timelineSub: {
        fontSize: 12,
        color: '#666',
        marginTop: 2,
    },
    shuttleHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    liveBadge: {
        backgroundColor: '#912338',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    liveText: {
        color: 'white',
        fontSize: 10,
        fontWeight: '900',
    },
    departureList: {
        marginTop: 10,
        marginBottom: 2,
    },
    departureCapsule: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        marginRight: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    selectedCapsule: {
        backgroundColor: '#912338',
        borderColor: '#912338',
    },
    departureText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#666',
    },
    selectedText: {
        color: 'white',
    },
    shuttleStatusCard: {
        marginTop: 8,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#F3F4F6',
        padding: 10,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    statusLabel: {
        fontSize: 10,
        color: '#888',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    statusValue: {
        fontSize: 20,
        fontWeight: '700',
        color: '#333',
    },
    divider: {
        width: 1,
        height: 30,
        backgroundColor: '#E5E7EB',
    },
    countdownBox: {
        alignItems: 'flex-end',
    },
    countdownLabel: {
        fontSize: 9,
        color: '#912338',
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    countdownValue: {
        fontSize: 14,
        fontWeight: '700',
        color: '#912338',
    },
    arrivalBox: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    arrivalValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    unavailableText: {
        color: '#D32F2F',
        fontSize: 12,
        fontStyle: 'italic',
        marginTop: 4,
    },
    loadingText: {
        marginTop: 10,
        color: '#666',
        fontSize: 14,
    },
    errorText: {
        color: '#D32F2F',
        textAlign: 'center',
        fontSize: 14,
    },
});

export default ShuttleDirections;
