import { getShuttleInfo } from '../../utils/shuttleLogic';

describe('shuttleLogic', () => {
    test('returns service unavailable on weekends (Saturday)', () => {
        const saturday = new Date('2026-02-21T10:00:00');
        const info = getShuttleInfo('LOY', saturday);
        expect(info.serviceUnavailable).toBe(true);
        expect(info.message).toBe('Service unavailable on weekends.');
    });

    test('returns service unavailable on weekends (Sunday)', () => {
        const sunday = new Date('2026-02-22T10:00:00');
        const info = getShuttleInfo('LOY', sunday);
        expect(info.serviceUnavailable).toBe(true);
    });

    test('returns Friday schedule on Friday', () => {
        const friday = new Date('2026-02-27T10:00:00');
        const info = getShuttleInfo('SGW', friday);
        expect(info.serviceUnavailable).toBe(false);
        // Friday 10:00 SGW -> next is 10:15 or similar
        expect(info.nextDeparture).toBe('10:00');
    });

    test('returns next departures on a weekday afternoon', () => {
        const monday = new Date('2026-02-23T15:34:00');
        const info = getShuttleInfo('LOY', monday);
        expect(info.serviceUnavailable).toBe(false);
        expect(info.nextDeparture).toBe('15:45');
        expect(info.nextThreeDepartures).toEqual(['15:45', '16:30', '16:45']);
        expect(info.estimatedArrival).toBe('16:15');
    });

    test('returns first shuttle if before operating hours', () => {
        const earlyMorning = new Date('2026-02-23T06:00:00');
        const info = getShuttleInfo('SGW', earlyMorning);
        expect(info.serviceUnavailable).toBe(false);
        expect(info.nextDeparture).toBe('09:30');
    });

    test('returns no more shuttles if after last bus', () => {
        const lateNight = new Date('2026-02-23T23:00:00');
        const info = getShuttleInfo('LOY', lateNight);
        expect(info.serviceUnavailable).toBe(true);
        expect(info.message).toBe('No more shuttles today.');
    });

    test('throws error for invalid campus', () => {
        const monday = new Date('2026-02-23T10:00:00');
        expect(() => getShuttleInfo('INVALID' as any, monday)).toThrow('Invalid campus input: INVALID');
    });
});
