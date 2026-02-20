import { getNearestStop } from '../../utils/locationLogic';

describe('locationLogic', () => {
    test('detects Loyola as nearest stop when closer', () => {
        const nearLoyola = {
            latitude: 45.459,
            longitude: -73.640,
        };
        const result = getNearestStop(nearLoyola);
        expect(result.stop).toBe('LOY');
        expect(result.destination).toBe('SGW');
    });

    test('detects SGW as nearest stop when closer', () => {
        const nearSGW = {
            latitude: 45.498,
            longitude: -73.579,
        };
        const result = getNearestStop(nearSGW);
        expect(result.stop).toBe('SGW');
        expect(result.destination).toBe('LOY');
    });
});
