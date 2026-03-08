import { CALENDAR_BASE } from "../constants/googleCalendar";
import type { CalendarEvent } from "./calendarHelpers";

const CONCORDIA_PREFIX_REGEX = /^concordia\s*-\s*/i;

export async function fetchNextConcordiaClassToday(
    accessToken: string,
    calendarId = "primary",
): Promise<CalendarEvent | null> {
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const params = new URLSearchParams({
        timeMin: now.toISOString(),
        timeMax: endOfDay.toISOString(),
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "50",
    });

    const url = `${CALENDAR_BASE}/calendars/${encodeURIComponent(
        calendarId,
    )}/events?${params.toString()}`;

    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
        throw new Error(`Google Calendar error: ${res.status}`);
    }

    const data = await res.json();

    const concordiaEvents = ((data.items as CalendarEvent[]) ?? []).filter(
        (event) => CONCORDIA_PREFIX_REGEX.test(event.summary ?? ""),
    );

    const nextEvent =
        concordiaEvents
            .filter((event) => {
                const start = event.start?.dateTime ?? event.start?.date;
                return start ? new Date(start) >= now : false;
            })
            .sort((a, b) => {
                const aStart = new Date(
                    a.start?.dateTime ?? a.start?.date ?? 0,
                ).getTime();
                const bStart = new Date(
                    b.start?.dateTime ?? b.start?.date ?? 0,
                ).getTime();
                return aStart - bStart;
            })[0] ?? null;

    return nextEvent;
}