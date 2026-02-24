import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Platform,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

WebBrowser.maybeCompleteAuthSession();

// CONFIG
const CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? "";

const SCOPES = [
    "https://www.googleapis.com/auth/calendar.readonly",
    "openid",
    "profile",
    "email",
];

const CALENDAR_API =
    "https://www.googleapis.com/calendar/v3/calendars/primary/events";

type CalendarEvent = {
    id: string;
    summary?: string;
    description?: string;
    location?: string;
    start: { dateTime?: string; date?: string };
    end: { dateTime?: string; date?: string };
};

// Helpers
function formatEventTime(start: CalendarEvent["start"]): string {
    if (start.dateTime) {
        const d = new Date(start.dateTime);
        return d.toLocaleString("en-CA", {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
        });
    }
    if (start.date) {
        const d = new Date(start.date + "T00:00:00");
        return d.toLocaleDateString("en-CA", {
            weekday: "short",
            month: "short",
            day: "numeric",
        });
    }
    return "Unknown time";
}

function isToday(event: CalendarEvent): boolean {
    const raw = event.start.dateTime ?? event.start.date;
    if (!raw) return false;
    const d = new Date(raw.includes("T") ? raw : raw + "T00:00:00");
    const now = new Date();
    return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
    );
}

// Component
export default function CalendarScreen() {
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Build the auth request
    const discovery = AuthSession.useAutoDiscovery("https://accounts.google.com");

    const redirectUri = useMemo(() => {
        if (Platform.OS === "web") {
            return AuthSession.makeRedirectUri();
        }
        return AuthSession.makeRedirectUri({ scheme: "concordiaclassfinder" });
    }, []);

    console.log("Redirect URI:", redirectUri);

    const [request, response, promptAsync] = AuthSession.useAuthRequest(
        {
            clientId: CLIENT_ID,
            scopes: SCOPES,
            redirectUri,
            responseType: AuthSession.ResponseType.Token,
            usePKCE: false,
            extraParams: {
                prompt: "select_account",
            },
        },
        discovery
    );

    // Handle OAuth response
    useEffect(() => {
        console.log("Auth response:", JSON.stringify(response));
        if (response?.type === "success") {
            const token = response.params.access_token;
            setAccessToken(token);
        } else if (response?.type === "error") {
            setError("Google sign-in failed. Please try again.");
        }
    }, [response]);

    // Fetch events that are stored in the Calender API
    useEffect(() => {
        if (accessToken) {
            loadEvents(accessToken, false);
        }
    }, [accessToken]);

    const loadEvents = useCallback(async (token: string, isRefresh: boolean) => {
        isRefresh ? setRefreshing(true) : setLoading(true);
        setError(null);

        try {
            const now = new Date().toISOString();
            const twoWeeksOut = new Date(
                Date.now() + 14 * 24 * 60 * 60 * 1000
            ).toISOString();

            const params = new URLSearchParams({
                timeMin: now,
                timeMax: twoWeeksOut,
                singleEvents: "true",
                orderBy: "startTime",
                maxResults: "50",
            });

            const res = await fetch(`${CALENDAR_API}?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!res.ok) {
                if (res.status === 401) {
                    // Token expired: sign the user out so they can re-authenticate
                    setAccessToken(null);
                    setEvents([]);
                    setError("Your session expired. Please sign in again.");
                    return;
                }
                throw new Error(`Calendar API error: ${res.status}`);
            }

            const data = await res.json();
            setEvents((data.items as CalendarEvent[]) ?? []);
        } catch (err) {
            setError("Failed to load events. Pull down to retry.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    const handleRefresh = () => {
        if (accessToken) loadEvents(accessToken, true);
    };

    const handleSignOut = () => {
        setAccessToken(null);
        setEvents([]);
    };

    // Not logged in
    if (!accessToken) {
        return (
            <SafeAreaView style={styles.centered}>
                <Text style={styles.welcomeTitle}>Google Calendar</Text>
                <Text style={styles.welcomeSub}>
                    See your upcoming events right inside the app.
                </Text>
                {error && <Text style={styles.errorText}>{error}</Text>}
                <Pressable
                    style={({ pressed }) => [
                        styles.signInButton,
                        pressed && styles.signInButtonPressed,
                    ]}
                    onPress={() => promptAsync()}
                    disabled={!request}
                >
                    <Text style={styles.signInButtonText}>Sign in with Google</Text>
                </Pressable>
            </SafeAreaView>
        );
    }

    if (loading) {
        return (
            <SafeAreaView style={styles.centered}>
                <ActivityIndicator size="large" color="#912338" />
                <Text style={styles.loadingText}>Loading your calendar…</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Upcoming Events</Text>
                <Pressable onPress={handleSignOut}>
                    <Text style={styles.signOutText}>Sign out</Text>
                </Pressable>
            </View>

            {error && (
                <View style={styles.errorBanner}>
                    <Text style={styles.errorBannerText}>{error}</Text>
                </View>
            )}

            {events.length === 0 ? (
                <View style={styles.centered}>
                    <Text style={styles.emptyText}>
                        No upcoming events in the next two weeks.
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={events}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            tintColor="#912338"
                        />
                    }
                    renderItem={({ item }) => (
                        <View style={[styles.card, isToday(item) && styles.cardToday]}>
                            {isToday(item) && (
                                <View style={styles.todayBadge}>
                                    <Text style={styles.todayBadgeText}>TODAY</Text>
                                </View>
                            )}
                            <Text style={styles.cardTitle} numberOfLines={2}>
                                {item.summary ?? "(No title)"}
                            </Text>
                            <Text style={styles.cardTime}>{formatEventTime(item.start)}</Text>
                            {item.location ? (
                                <Text style={styles.cardLocation} numberOfLines={1}>
                                    {item.location}
                                </Text>
                            ) : null}
                            {item.description ? (
                                <Text style={styles.cardDescription} numberOfLines={2}>
                                    {item.description}
                                </Text>
                            ) : null}
                        </View>
                    )}
                />
            )}
        </SafeAreaView>
    );
}

// Styles
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F2F2F7",
    },
    centered: {
        flex: 1,
        backgroundColor: "#F2F2F7",
        alignItems: "center",
        justifyContent: "center",
        padding: 28,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 12,
        backgroundColor: "#F2F2F7",
    },
    headerTitle: {
        fontSize: 26,
        fontWeight: "700",
        color: "#1C1C1E",
    },
    signOutText: {
        fontSize: 14,
        color: "#912338",
        fontWeight: "600",
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 100,
    },
    card: {
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    cardToday: {
        borderLeftWidth: 4,
        borderLeftColor: "#912338",
    },
    todayBadge: {
        alignSelf: "flex-start",
        backgroundColor: "#912338",
        borderRadius: 6,
        paddingHorizontal: 7,
        paddingVertical: 2,
        marginBottom: 6,
    },
    todayBadgeText: {
        color: "#fff",
        fontSize: 10,
        fontWeight: "800",
        letterSpacing: 0.5,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: "#1C1C1E",
        marginBottom: 4,
    },
    cardTime: {
        fontSize: 13,
        color: "#007AFF",
        fontWeight: "600",
        marginBottom: 4,
    },
    cardLocation: {
        fontSize: 13,
        color: "#555",
        marginBottom: 4,
    },
    cardDescription: {
        fontSize: 13,
        color: "#8E8E93",
        lineHeight: 18,
    },
    welcomeTitle: {
        fontSize: 30,
        fontWeight: "800",
        color: "#1C1C1E",
        marginBottom: 10,
        textAlign: "center",
    },
    welcomeSub: {
        fontSize: 15,
        color: "#6C6C70",
        textAlign: "center",
        marginBottom: 32,
        lineHeight: 22,
    },
    signInButton: {
        backgroundColor: "#912338",
        paddingVertical: 14,
        paddingHorizontal: 36,
        borderRadius: 14,
    },
    signInButtonPressed: {
        opacity: 0.8,
    },
    signInButtonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700",
    },
    loadingText: {
        marginTop: 12,
        color: "#6C6C70",
        fontSize: 14,
    },
    emptyText: {
        fontSize: 15,
        color: "#8E8E93",
        textAlign: "center",
        lineHeight: 22,
    },
    errorText: {
        color: "#D32F2F",
        fontSize: 13,
        marginBottom: 16,
        textAlign: "center",
    },
    errorBanner: {
        backgroundColor: "#FEE2E2",
        marginHorizontal: 16,
        borderRadius: 10,
        padding: 10,
        marginBottom: 8,
    },
    errorBannerText: {
        color: "#D32F2F",
        fontSize: 13,
        textAlign: "center",
    },
});