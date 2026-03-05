import * as AuthSession from "expo-auth-session";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Platform,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CALENDAR_BASE, CLIENT_ID, SCOPES } from "../../constants/googleCalendar";
import { CalendarEvent, formatEventTime, GoogleCalendar, isToday } from "../../utils/calendarHelpers";

WebBrowser.maybeCompleteAuthSession();

export default function CalendarScreen() {
    const [accessToken, setAccessToken] = useState<string | null>(null);

    const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
    const [selectedCalendarId, setSelectedCalendarId] = useState<string>("primary");

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

    useEffect(() => {
        console.log("redirectUri var:", redirectUri);
        console.log("Auth request URL:", request?.url);
    }, [redirectUri, request]);

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

    const handleTokenExpired = useCallback(() => {
        setAccessToken(null);
        setCalendars([]);
        setSelectedCalendarId("primary");
        setEvents([]);
        setError("Your session expired. Please sign in again.");
    }, []);

    // Load calendars (once token is available)
    const loadCalendars = useCallback(
        async (token: string) => {
            try {
                setError(null);

                const res = await fetch(`${CALENDAR_BASE}/users/me/calendarList`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!res.ok) {
                    if (res.status === 401) {
                        handleTokenExpired();
                        return;
                    }
                    throw new Error(`CalendarList error: ${res.status}`);
                }

                const data = await res.json();

                console.log(
                    "WHOAMI (token account):",
                    await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
                        headers: { Authorization: `Bearer ${token}` },
                    }).then((r) => r.json())
                );

                console.log(
                    "CALENDARLIST NAMES:",
                    (data.items ?? []).map((c: any) => ({
                        id: c.id,
                        summary: c.summary,
                        summaryOverride: c.summaryOverride,
                        primary: c.primary,
                    }))
                );

                const list: GoogleCalendar[] = ((data.items ?? []) as any[]).map((c) => {
                    let name = c.summaryOverride ?? c.summary ?? "(Untitled calendar)";

                    if (c.primary && typeof name === "string" && name.includes("@")) {
                        name = "Primary Calendar";
                    }

                    return {
                        id: c.id,
                        summary: name,
                        primary: !!c.primary,
                    };
                });

                // Put primary first
                list.sort((a, b) => Number(!!b.primary) - Number(!!a.primary));
                setCalendars(list);

                const primary = list.find((c) => c.primary);
                if (primary) setSelectedCalendarId(primary.id);
                else if (list.length > 0) setSelectedCalendarId(list[0].id);
            } catch {
                setError("Failed to load your calendars.");
            }
        },
        [handleTokenExpired]
    );

    // Load events 
    const loadEvents = useCallback(
        async (token: string, isRefresh: boolean) => {
            isRefresh ? setRefreshing(true) : setLoading(true);
            setError(null);

            try {
                const now = new Date().toISOString();
                const twoWeeksOut = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

                const params = new URLSearchParams({
                    timeMin: now,
                    timeMax: twoWeeksOut,
                    singleEvents: "true",
                    orderBy: "startTime",
                    maxResults: "50",
                });

                const url = `${CALENDAR_BASE}/calendars/${encodeURIComponent(
                    selectedCalendarId
                )}/events?${params.toString()}`;

                const res = await fetch(url, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!res.ok) {
                    if (res.status === 401) {
                        handleTokenExpired();
                        return;
                    }
                    throw new Error(`Calendar API error: ${res.status}`);
                }

                const data = await res.json();
                setEvents((data.items as CalendarEvent[]) ?? []);
            } catch {
                setError("Failed to load events. Pull down to retry.");
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        [selectedCalendarId, handleTokenExpired]
    );

    // Fetch calendars whenever we have a token
    useEffect(() => {
        if (accessToken) {
            loadCalendars(accessToken);
        }
    }, [accessToken, loadCalendars]);

    // Fetch events when token or selected calendar changes
    useEffect(() => {
        if (accessToken) {
            loadEvents(accessToken, false);
        }
    }, [accessToken, selectedCalendarId, loadEvents]);

    const handleRefresh = () => {
        if (accessToken) loadEvents(accessToken, true);
    };

    const handleSignOut = () => {
        setAccessToken(null);
        setCalendars([]);
        setSelectedCalendarId("primary");
        setEvents([]);
    };

    // Not logged in 
    if (!accessToken) {
        return (
            <SafeAreaView style={styles.centered}>
                
                <Text style={styles.welcomeTitle}>Google Calendar</Text>
                <Text style={styles.welcomeSub}>See your upcoming events right inside the app.</Text>
                {error && <Text style={styles.errorText}>{error}</Text>}
                <Pressable
                    style={({ pressed }) => [styles.signInButton, pressed && styles.signInButtonPressed]}
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

    const selectedCalendar =
        calendars.find((c) => c.id === selectedCalendarId) ??
        calendars.find((c) => c.primary);

    const selectedName =
        (selectedCalendar as any)?.summaryOverride ??
        selectedCalendar?.summary ??
        (selectedCalendarId === "primary" ? "Primary" : "Selected calendar");
        const now = new Date();

        const nextEvent =
        (events ?? [])
          .filter((e) => {
            const start = e?.start?.dateTime ?? e?.start?.date;
            return start ? new Date(start) >= now : false;
          })
          .sort((a, b) => {
            const aStart = new Date(a?.start?.dateTime ?? a?.start?.date ?? 0).getTime();
            const bStart = new Date(b?.start?.dateTime ?? b?.start?.date ?? 0).getTime();
            return aStart - bStart;
          })[0] ?? null;

          const parseClassLocation = (raw?: string | null) => {
            if (!raw) return null;
          
            const s = raw.trim();
          
            // Common pattern: H-510, H 510, MB-1.210, etc.
            const match = s.match(/\b([A-Za-z]{1,4})\s*[-]?\s*([0-9]{1,4}[A-Za-z]?)\b/);
          
            if (!match) return s; // fallback: show original text
          
            const building = match[1].toUpperCase();
            const room = match[2].toUpperCase();
          
            return `${building}-${room}`;
          };

          const parseBuilding = (location?: string) => {
            
            const raw = location?.trim();
            if (!raw) return null;
          
            const building = raw.split("-")[0]?.trim();
            return building?.length ? building : null;
          };
          
          const handleDirectionsPress = () => {
            const building = parseBuilding(nextEvent?.location);
          
            
            if (!building) {
              Alert.alert(
                "Directions unavailable",
                "This class has no location saved. Please add a building/room (ex: H-510) in your Google Calendar event."
              );
              return;
            }
          
            // If we have a building, go to Map and set destination
            // (we'll handle the Map screen in a minute)
            router.push({
              pathname: "/(tabs)",
              params: { toBuilding: building }, 
            });
          };
    // List of events
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Upcoming Events</Text>
                <Pressable onPress={handleSignOut}>
                    <Text style={styles.signOutText}>Sign out</Text>
                </Pressable>
            </View>

            {/* Calendar Selector */}
            <View style={styles.pickerWrap}>
                <Text style={styles.pickerLabel}>Calendar</Text>

                <Text style={styles.selectedCalendarName} numberOfLines={1}>
                    {selectedName}
                </Text>

                <View style={styles.pickerRow}>
                    {calendars.slice(0, 3).map((c) => (
                        <Pressable
                            key={c.id}
                            onPress={() => setSelectedCalendarId(c.id)}
                            style={[styles.pill, selectedCalendarId === c.id && styles.pillActive]}
                        >
                            <Text
                                style={[styles.pillText, selectedCalendarId === c.id && styles.pillTextActive]}
                                numberOfLines={1}
                            >
                                {c.summary}
                            </Text>
                        </Pressable>
                    ))}
                </View>

                {calendars.length > 3 && (
                    <View style={styles.moreList}>
                        {calendars.slice(3).map((c) => (
                            <Pressable key={c.id} onPress={() => setSelectedCalendarId(c.id)} style={styles.moreItem}>
                                <Text style={styles.moreItemText} numberOfLines={1}>
                                    {selectedCalendarId === c.id ? "✓ " : ""}
                                    {c.summary}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                )}

                {calendars.length === 0 && (
                    <Text style={styles.noCalendarsText}>No calendars found. Try signing out and signing back in.</Text>
                )}
            </View>

            {error && (
                <View style={styles.errorBanner}>
                    <Text style={styles.errorBannerText}>{error}</Text>
                </View>
            )}

            {events.length === 0 ? (
                <View style={styles.centered}>
                    <Text style={styles.emptyText}>No upcoming events in the next two weeks.</Text>
                </View>
            ) : (
                <>
                {nextEvent && (
  <View style={styles.nextClassCard}>
    <Text style={styles.nextClassTitle}>Next Class</Text>

    <Text style={styles.nextClassCourse}>
      {nextEvent?.summary ?? "Untitled class"}
    </Text>

    <Text style={styles.nextClassTime}>
      {nextEvent?.start ? formatEventTime(nextEvent.start) : "Time not provided"}
    </Text>

    <Text style={styles.nextClassLocation}>
  {nextEvent?.location?.trim()
    ? parseClassLocation(nextEvent.location)
    : "Location not provided"}
</Text>
<Pressable style={styles.directionsButton} onPress={handleDirectionsPress}>
  <Text style={styles.directionsButtonText}>Directions</Text>
</Pressable>
  </View>
)}
                <FlatList
                    data={events}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#912338" />
                        
                        
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
                            <Text style={styles.cardLocation} numberOfLines={1}>
                                  {item.location?.trim()
                                  ? parseClassLocation(item.location)
                                      : "Location not provided"}
                            </Text>
                            {item.description ? (
                                <Text style={styles.cardDescription} numberOfLines={2}>
                                    {item.description}
                                </Text>
                            ) : null}
                           
                        </View>
                    )}
                />
                </>
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

    pickerWrap: {
        marginHorizontal: 16,
        marginBottom: 8,
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        padding: 12,
        shadowColor: "#000",
        shadowOpacity: 0.04,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 1,
    },
    pickerLabel: {
        fontSize: 12,
        fontWeight: "700",
        color: "#6C6C70",
        marginBottom: 6,
    },
    selectedCalendarName: {
        fontSize: 14,
        fontWeight: "800",
        color: "#1C1C1E",
        marginBottom: 10,
    },
    pickerRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    pill: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 999,
        backgroundColor: "#F2F2F7",
        maxWidth: "100%",
    },
    pillActive: {
        backgroundColor: "#912338",
    },
    pillText: {
        fontSize: 13,
        fontWeight: "700",
        color: "#1C1C1E",
    },
    pillTextActive: {
        color: "#FFFFFF",
    },
    moreList: {
        marginTop: 10,
        borderTopWidth: 1,
        borderTopColor: "#EFEFF4",
        paddingTop: 8,
    },
    moreItem: {
        paddingVertical: 8,
    },
    moreItemText: {
        fontSize: 13,
        color: "#1C1C1E",
        fontWeight: "600",
    },
    noCalendarsText: {
        marginTop: 10,
        fontSize: 13,
        color: "#8E8E93",
        lineHeight: 18,
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
    nextClassCard: {
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 10,
        padding: 12,
        marginBottom: 10,
      },
      
      nextClassTitle: {
        fontWeight: "700",
        fontSize: 16,
        marginBottom: 4,
      },
      
      nextClassCourse: {
        fontWeight: "600",
        fontSize: 14,
      },
      
      nextClassLocation: {
        marginTop: 4,
      },
      nextClassTime: {
        fontSize: 14,
        color: "#666",
        marginTop: 4,
      },
      directionsButton: {
        marginTop: 10,
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: "center",
        backgroundColor: "#912338",
      },
      directionsButtonText: {
        color: "white",
        fontWeight: "600",
      },
});