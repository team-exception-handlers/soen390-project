export type CalendarEvent = {
    id: string;
    summary?: string;
    description?: string;
    location?: string;
    start: { dateTime?: string; date?: string };
    end: { dateTime?: string; date?: string };
};

export type GoogleCalendar = {
    id: string;
    summary: string;
    primary?: boolean;
};

export function formatEventTime(start: CalendarEvent["start"]): string {
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

export function isToday(event: CalendarEvent): boolean {
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