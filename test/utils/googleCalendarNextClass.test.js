const { fetchNextConcordiaClassToday } = require("../../utils/googleCalendarNextClass");

describe("fetchNextConcordiaClassToday", () => {
    const realFetch = globalThis.fetch;

    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date("2026-03-07T10:00:00Z"));
        globalThis.fetch = jest.fn();
    });

    afterEach(() => {
        jest.useRealTimers();
        globalThis.fetch = realFetch;
        jest.clearAllMocks();
    });

    test("returns earliest upcoming Concordia class", async () => {
        globalThis.fetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                items: [
                    {
                        id: "1",
                        summary: "Concordia - COMP 249",
                        location: "H-510",
                        start: { dateTime: "2026-03-07T13:00:00Z" },
                    },
                    {
                        id: "2",
                        summary: "Concordia - SOEN 287",
                        location: "EV-1.605",
                        start: { dateTime: "2026-03-07T11:00:00Z" },
                    },
                ],
            }),
        });

        const result = await fetchNextConcordiaClassToday("token");

        expect(result.id).toBe("2");
        expect(result.location).toBe("EV-1.605");
    });

    test("matches concordia prefix case-insensitively", async () => {
        globalThis.fetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                items: [
                    {
                        id: "1",
                        summary: "concordia - COMP 249",
                        location: "H-510",
                        start: { dateTime: "2026-03-07T11:00:00Z" },
                    },
                ],
            }),
        });

        const result = await fetchNextConcordiaClassToday("token");

        expect(result.summary).toBe("concordia - COMP 249");
    });

    test("matches concordia prefix with flexible spacing", async () => {
        globalThis.fetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                items: [
                    {
                        id: "1",
                        summary: "Concordia- COMP 249",
                        location: "H-510",
                        start: { dateTime: "2026-03-07T11:00:00Z" },
                    },
                    {
                        id: "2",
                        summary: "Concordia - SOEN 228",
                        location: "MB-S2.330",
                        start: { dateTime: "2026-03-07T12:00:00Z" },
                    },
                ],
            }),
        });

        const result = await fetchNextConcordiaClassToday("token");

        expect(result.id).toBe("1");
    });

    test("ignores non-Concordia events", async () => {
        globalThis.fetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                items: [
                    {
                        id: "1",
                        summary: "Dentist Appointment",
                        location: "Clinic",
                        start: { dateTime: "2026-03-07T10:30:00Z" },
                    },
                    {
                        id: "2",
                        summary: "Concordia - COMP 249",
                        location: "H-510",
                        start: { dateTime: "2026-03-07T11:00:00Z" },
                    },
                ],
            }),
        });

        const result = await fetchNextConcordiaClassToday("token");

        expect(result.id).toBe("2");
    });

    test("ignores past events", async () => {
        globalThis.fetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                items: [
                    {
                        id: "1",
                        summary: "Concordia - Past",
                        location: "H-510",
                        start: { dateTime: "2026-03-07T08:00:00Z" },
                    },
                    {
                        id: "2",
                        summary: "Concordia - Future",
                        location: "EV-1",
                        start: { dateTime: "2026-03-07T12:00:00Z" },
                    },
                ],
            }),
        });

        const result = await fetchNextConcordiaClassToday("token");

        expect(result.id).toBe("2");
    });

    test("returns null when no Concordia classes exist", async () => {
        globalThis.fetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                items: [
                    {
                        id: "1",
                        summary: "Doctor Appointment",
                        start: { dateTime: "2026-03-07T11:00:00Z" },
                    },
                ],
            }),
        });

        const result = await fetchNextConcordiaClassToday("token");

        expect(result).toBeNull();
    });

    test("returns null when there are no upcoming Concordia classes today", async () => {
        globalThis.fetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                items: [
                    {
                        id: "1",
                        summary: "Concordia - Earlier Class",
                        location: "H-510",
                        start: { dateTime: "2026-03-07T08:00:00Z" },
                    },
                ],
            }),
        });

        const result = await fetchNextConcordiaClassToday("token");

        expect(result).toBeNull();
    });

    test("returns null when API returns no items", async () => {
        globalThis.fetch.mockResolvedValue({
            ok: true,
            json: async () => ({ items: [] }),
        });

        const result = await fetchNextConcordiaClassToday("token");

        expect(result).toBeNull();
    });

    test("throws on API error", async () => {
        globalThis.fetch.mockResolvedValue({
            ok: false,
            status: 401,
        });

        await expect(fetchNextConcordiaClassToday("token")).rejects.toThrow(
            "Google Calendar error: 401",
        );
    });

    test("sends access token in Authorization header", async () => {
        globalThis.fetch.mockResolvedValue({
            ok: true,
            json: async () => ({ items: [] }),
        });

        await fetchNextConcordiaClassToday("secret-token");

        expect(globalThis.fetch).toHaveBeenCalledTimes(1);

        const options = globalThis.fetch.mock.calls[0][1];
        expect(options.headers.Authorization).toBe("Bearer secret-token");
    });

    describe("fetchNextConcordiaClassToday extra branch coverage", () => {
        const realFetch = globalThis.fetch;

        beforeEach(() => {
            jest.useFakeTimers();
            jest.setSystemTime(new Date("2026-03-07T10:00:00Z"));
            globalThis.fetch = jest.fn();
        });

        afterEach(() => {
            jest.useRealTimers();
            globalThis.fetch = realFetch;
            jest.clearAllMocks();
        });

        test("returns null when items is missing", async () => {
            globalThis.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({}),
            });

            const result = await fetchNextConcordiaClassToday("token");
            expect(result).toBeNull();
        });

        test("ignores events with missing summary", async () => {
            globalThis.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    items: [
                        {
                            id: "1",
                            location: "H-510",
                            start: { dateTime: "2026-03-07T11:00:00Z" },
                        },
                        {
                            id: "2",
                            summary: "Concordia - COMP 249",
                            location: "H-520",
                            start: { dateTime: "2026-03-07T12:00:00Z" },
                        },
                    ],
                }),
            });

            const result = await fetchNextConcordiaClassToday("token");
            expect(result.id).toBe("2");
        });

        test("supports events that use start.date instead of start.dateTime", async () => {
            globalThis.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    items: [
                        {
                            id: "1",
                            summary: "Concordia - All Day",
                            location: "H-510",
                            start: { date: "2026-03-07T11:00:00Z" },
                        },
                    ],
                }),
            });

            const result = await fetchNextConcordiaClassToday("token");
            expect(result.id).toBe("1");
        });

        test("ignores events with missing start", async () => {
            globalThis.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    items: [
                        {
                            id: "1",
                            summary: "Concordia - No Start",
                            location: "H-510",
                        },
                        {
                            id: "2",
                            summary: "Concordia - Valid",
                            location: "EV-1.605",
                            start: { dateTime: "2026-03-07T11:00:00Z" },
                        },
                    ],
                }),
            });

            const result = await fetchNextConcordiaClassToday("token");
            expect(result.id).toBe("2");
        });

        test("sorts correctly when one event uses date and another uses dateTime", async () => {
            globalThis.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    items: [
                        {
                            id: "1",
                            summary: "Concordia - Later",
                            start: { dateTime: "2026-03-07T12:00:00Z" },
                        },
                        {
                            id: "2",
                            summary: "Concordia - Earlier",
                            start: { date: "2026-03-07T11:00:00Z" },
                        },
                    ],
                }),
            });

            const result = await fetchNextConcordiaClassToday("token");
            expect(result.id).toBe("2");
        });

        test("uses a custom calendarId when provided", async () => {
            globalThis.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({ items: [] }),
            });

            await fetchNextConcordiaClassToday("token", "my-calendar-id");

            const calledUrl = globalThis.fetch.mock.calls[0][0];
            expect(calledUrl).toContain("/calendars/my-calendar-id/events");
        });

        test("encodes a custom calendarId when provided", async () => {
            globalThis.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({ items: [] }),
            });

            await fetchNextConcordiaClassToday("token", "abc@group.calendar.google.com");

            const calledUrl = globalThis.fetch.mock.calls[0][0];
            expect(calledUrl).toContain(
                encodeURIComponent("abc@group.calendar.google.com"),
            );
        });

        test("propagates fetch rejection", async () => {
            globalThis.fetch.mockRejectedValue(new Error("network fail"));

            await expect(fetchNextConcordiaClassToday("token")).rejects.toThrow(
                "network fail",
            );
        });
    });
});