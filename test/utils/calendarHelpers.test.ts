import { CalendarEvent, formatEventTime, isToday } from "../../utils/calendarHelpers";

describe("formatEventTime", () => {
    it("formats a dateTime event correctly", () => {
        const result = formatEventTime({ dateTime: "2025-03-15T14:30:00" });
        expect(result).toContain("2:30");
    });

    it("formats an all-day event correctly", () => {
        const result = formatEventTime({ date: "2025-03-15" });
        expect(result).toContain("Mar");
        expect(result).toContain("15");
    });

    it("returns 'Unknown time' when no date is provided", () => {
        const result = formatEventTime({});
        expect(result).toBe("Unknown time");
    });
});

describe("isToday", () => {
    it("returns true for an event happening today", () => {
        const today = new Date().toISOString();
        const event: CalendarEvent = {
            id: "1",
            start: { dateTime: today },
            end: { dateTime: today },
        };
        expect(isToday(event)).toBe(true);
    });

    it("returns false for an event in the past", () => {
        const event: CalendarEvent = {
            id: "2",
            start: { date: "2000-01-01" },
            end: { date: "2000-01-01" },
        };
        expect(isToday(event)).toBe(false);
    });

    it("returns false when no start date is provided", () => {
        const event: CalendarEvent = {
            id: "3",
            start: {},
            end: {},
        };
        expect(isToday(event)).toBe(false);
    });
});