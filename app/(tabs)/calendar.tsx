import { parseClassLocation, parseLocationParts } from "@/utils/classLocation";
import {
    clearToken,
    getToken,
    isAuthError,
    saveToken,
} from "@/utils/googleCalendarAuth";
import * as AuthSession from "expo-auth-session";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { useRouter } from "expo-router";
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
import {
    CALENDAR_BASE,
    CLIENT_ID,
    SCOPES,
} from "../../constants/googleCalendar";
import {
    CalendarEvent,
    formatEventTime,
    GoogleCalendar,
    isToday,
} from "../../utils/calendarHelpers";

WebBrowser.maybeCompleteAuthSession();

const E2E_MOCK_TOKEN = "e2e-google-calendar-token";

function buildE2ECalendarFixtures(): {
  calendars: GoogleCalendar[];
  eventsByCalendarId: Record<string, CalendarEvent[]>;
} {
  const now = Date.now();
  const inHours = (hoursFromNow: number) =>
    new Date(now + hoursFromNow * 60 * 60 * 1000).toISOString();

  return {
    calendars: [
      { id: "primary", summary: "Primary Calendar", primary: true },
      { id: "holidays-canada", summary: "Holidays in Canada" },
    ],
    eventsByCalendarId: {
      primary: [
        {
          id: "e2e-next-class",
          summary: "Concordia - SOEN 390 Tutorial",
          description: "CI fixture event for Maestro.",
          location: "SP-110",
          start: { dateTime: inHours(2) },
          end: { dateTime: inHours(3) },
        },
        {
          id: "e2e-later-class",
          summary: "Concordia - COMP 352 Lecture",
          location: "H-937",
          start: { dateTime: inHours(26) },
          end: { dateTime: inHours(27.5) },
        },
      ],
      "holidays-canada": [
        {
          id: "e2e-holiday",
          summary: "Canada Day",
          start: { dateTime: inHours(48) },
          end: { dateTime: inHours(49) },
        },
      ],
    },
  };
}

export default function CalendarScreen() {
  const [directionsMessage, setDirectionsMessage] = useState<string | null>(
    null,
  );
  const router = useRouter();
  const [accessToken, setAccessToken] = useState<string | null>(null);

  /* Expo Go on the simulator doesn't register our custom `concordiaclassfinder://` scheme.
   * In that case we must use the redirect URI Expo Go supports.
   */
  const isExpoGo =
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  const isE2EMode = process.env.EXPO_PUBLIC_ENABLE_E2E_HOOKS === "1";

  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] =
    useState<string>("primary");

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const e2eFixtures = useMemo(() => buildE2ECalendarFixtures(), []);

  // Build the auth request
  const discovery = AuthSession.useAutoDiscovery("https://accounts.google.com");

  const redirectUri = useMemo(() => {
    if (Platform.OS === "web") {
      return AuthSession.makeRedirectUri();
    }
    if (isExpoGo || isE2EMode) {
      const owner = Constants.expoConfig?.owner ?? "anonymous";
      const slug = Constants.expoConfig?.slug ?? "concordia-class-finder";
      const projectNameForProxy = owner
        ? `@${owner}/${slug}`
        : `@anonymous/${slug}`;
      return `https://auth.expo.io/${projectNameForProxy}`;
    }

    return AuthSession.makeRedirectUri({ scheme: "concordiaclassfinder" });
  }, [isE2EMode, isExpoGo]);

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
    discovery,
  );

  const handleSignInPress = useCallback(async () => {
    if (!request) return;

    // Expo Go must bootstrap auth through the Expo proxy `/start` endpoint so auth.expo.io can map the OAuth callback back to this session.
    if ((isExpoGo || isE2EMode) && Platform.OS !== "web") {
      if (!discovery) {
        setError("Google sign-in is not ready yet. Please try again.");
        return;
      }

      try {
        setError(null);
        const returnUrl = AuthSession.getDefaultReturnUrl();
        const authUrl = await request.makeAuthUrlAsync(discovery);
        const startUrl = `${redirectUri}/start?${new URLSearchParams({
          authUrl,
          returnUrl,
        }).toString()}`;

        const browserResult = await WebBrowser.openAuthSessionAsync(
          startUrl,
          returnUrl,
        );

        if (browserResult.type === "success") {
          const parsed = request.parseReturnUrl(browserResult.url);
          if (parsed.type !== "success") {
            setError("Google sign-in failed. Please try again.");
            return;
          }

          const token = parsed.params.access_token;

          if (!token) {
            setError("Google sign-in failed. No access token received.");
            return;
          }

          const expiresIn = parsed.params.expires_in
            ? Number(parsed.params.expires_in)
            : undefined;

          setAccessToken(token);
          await saveToken(token, expiresIn);
          return;
        }

        if (browserResult.type !== "cancel") {
          setError("Google sign-in failed. Please try again.");
        }
        return;
      } catch {
        setError("Google sign-in failed. Please try again.");
        return;
      }
    }

    await promptAsync();
  }, [request, isExpoGo, isE2EMode, discovery, redirectUri, promptAsync]);

  // Handle OAuth response (non-Expo-Go path)
  useEffect(() => {
    const handleResponse = async () => {
      if (response?.type === "success") {
        const token = response.params.access_token;
        const expiresIn = response.params.expires_in
          ? Number(response.params.expires_in)
          : undefined;
        setAccessToken(token);
        await saveToken(token, expiresIn);
      } else if (response?.type === "error") {
        setError("Google sign-in failed. Please try again.");
      }
    };

    handleResponse();
  }, [response]);

  useEffect(() => {
    if (isE2EMode) {
      setAccessToken(E2E_MOCK_TOKEN);
      return;
    }

    const restoreToken = async () => {
      const saved = await getToken();
      if (saved) {
        setAccessToken(saved);
      }
    };

    restoreToken();
  }, []);

  const handleTokenExpired = useCallback(async () => {
    setAccessToken(null);
    setCalendars([]);
    setSelectedCalendarId("primary");
    setEvents([]);
    setError("Your session expired. Please sign in again.");
    await clearToken();
  }, []);

  // Load calendars (once token is available)
  const loadCalendars = useCallback(
    async (token: string) => {
      if (isE2EMode && token === E2E_MOCK_TOKEN) {
        setError(null);
        setCalendars(e2eFixtures.calendars);
        const primary =
          e2eFixtures.calendars.find((calendar) => calendar.primary) ??
          e2eFixtures.calendars[0];
        if (primary) {
          setSelectedCalendarId(primary.id);
        }
        return;
      }

      try {
        setError(null);

        const res = await fetch(`${CALENDAR_BASE}/users/me/calendarList`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          if (isAuthError(res.status)) {
            handleTokenExpired();
            return;
          }
          throw new Error(`CalendarList error: ${res.status}`);
        }

        const data = await res.json();

        const list: GoogleCalendar[] = ((data.items ?? []) as any[]).map(
          (c) => {
            let name = c.summaryOverride ?? c.summary ?? "(Untitled calendar)";

            if (c.primary && typeof name === "string" && name.includes("@")) {
              name = "Primary Calendar";
            }

            return {
              id: c.id,
              summary: name,
              primary: !!c.primary,
            };
          },
        );

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
    [e2eFixtures.calendars, handleTokenExpired, isE2EMode],
  );

  // Load events
  const loadEvents = useCallback(
    async (token: string, isRefresh: boolean) => {
      if (isE2EMode && token === E2E_MOCK_TOKEN) {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        setError(null);
        setEvents(e2eFixtures.eventsByCalendarId[selectedCalendarId] ?? []);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const now = new Date().toISOString();
        const twoWeeksOut = new Date(
          Date.now() + 14 * 24 * 60 * 60 * 1000,
        ).toISOString();

        const params = new URLSearchParams({
          timeMin: now,
          timeMax: twoWeeksOut,
          singleEvents: "true",
          orderBy: "startTime",
          maxResults: "50",
        });

        const url = `${CALENDAR_BASE}/calendars/${encodeURIComponent(
          selectedCalendarId,
        )}/events?${params.toString()}`;

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          if (isAuthError(res.status)) {
            handleTokenExpired();
            return;
          }
          throw new Error(`Calendar API error: ${res.status}`);
        }

        const data = await res.json();

        const concordiaEvents = ((data.items as CalendarEvent[]) ?? []).filter(
          (event) => /^concordia\s*-\s*/i.test(event.summary ?? ""),
        );
        setEvents(concordiaEvents);
      } catch {
        setError("Failed to load events. Pull down to retry.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [e2eFixtures.eventsByCalendarId, handleTokenExpired, isE2EMode, selectedCalendarId],
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

  const handleSignOut = async () => {
    setAccessToken(null);
    setCalendars([]);
    setSelectedCalendarId("primary");
    setEvents([]);
    await clearToken();
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
          onPress={handleSignInPress}
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
        const aStart = new Date(
          a?.start?.dateTime ?? a?.start?.date ?? 0,
        ).getTime();
        const bStart = new Date(
          b?.start?.dateTime ?? b?.start?.date ?? 0,
        ).getTime();
        return aStart - bStart;
      })[0] ?? null;

  const handleDirectionsPress = () => {
    const { building, room } = parseLocationParts(nextEvent?.location);

    if (!building) {
      setDirectionsMessage(
        "Directions cannot be generated because this class has no location. Please add a building/room such as H-510 to the calendar event.",
      );
      return;
    }

    setDirectionsMessage(null);

    router.push({
      pathname: "/(tabs)",
      params: {
        toBuilding: building,
        toRoom: room ?? "",
      },
    } as any);
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
              style={[
                styles.pill,
                selectedCalendarId === c.id && styles.pillActive,
              ]}
            >
              <Text
                style={[
                  styles.pillText,
                  selectedCalendarId === c.id && styles.pillTextActive,
                ]}
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
              <Pressable
                key={c.id}
                onPress={() => setSelectedCalendarId(c.id)}
                style={styles.moreItem}
              >
                <Text style={styles.moreItemText} numberOfLines={1}>
                  {selectedCalendarId === c.id ? "✓ " : ""}
                  {c.summary}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {calendars.length === 0 && (
          <Text style={styles.noCalendarsText}>
            No calendars found. Try signing out and signing back in.
          </Text>
        )}
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
        <>
          {nextEvent && (
            <View style={styles.nextClassCard}>
              <Text style={styles.nextClassTitle}>Next Class</Text>

              <Text style={styles.nextClassCourse}>
                {nextEvent?.summary ?? "Untitled class"}
              </Text>

              <Text style={styles.nextClassTime}>
                {nextEvent?.start
                  ? formatEventTime(nextEvent.start)
                  : "Time not provided"}
              </Text>

              <Text style={styles.nextClassLocation}>
                {nextEvent?.location?.trim()
                  ? parseClassLocation(nextEvent.location)
                  : "Location not provided"}
              </Text>

              <Pressable
                style={styles.directionsButton}
                onPress={handleDirectionsPress}
              >
                <Text style={styles.directionsButtonText}>Directions</Text>
              </Pressable>
              {directionsMessage ? (
                <Text style={styles.directionsMessage}>
                  {directionsMessage}
                </Text>
              ) : null}
            </View>
          )}
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
                <Text style={styles.cardTime}>
                  {formatEventTime(item.start)}
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
  directionsMessage: {
    marginTop: 8,
    color: "#A32638",
    fontSize: 12,
    fontWeight: "600",
  },
});
