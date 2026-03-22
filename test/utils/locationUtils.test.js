jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
  Accuracy: { High: 'high', Balanced: 'balanced', Lowest: 'lowest' },
}));

describe('utils/locationUtils', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('requestLocationPermission returns true when granted', async () => {
    const Location = require('expo-location');
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    const path = require('node:path');
    const { requestLocationPermission } = require(path.join(__dirname, '..', '..', 'utils', 'locationUtils.ts'));
    await expect(requestLocationPermission()).resolves.toBe(true);
  });

  test('hasLocationPermission returns false when not granted', async () => {
    const Location = require('expo-location');
    Location.getForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
    const path = require('node:path');
    const { hasLocationPermission } = require(path.join(__dirname, '..', '..', 'utils', 'locationUtils.ts'));
    await expect(hasLocationPermission()).resolves.toBe(false);
  });

  test('startWatchingLocation returns subscription when permission already granted', async () => {
    const Location = require('expo-location');
    Location.getForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    Location.watchPositionAsync.mockResolvedValue({ unsubscribe: () => {} });

    const path = require('node:path');
    const { startWatchingLocation } = require(path.join(__dirname, '..', '..', 'utils', 'locationUtils.ts'));
    const cb = jest.fn();
    const sub = await startWatchingLocation(cb);
    expect(Location.watchPositionAsync).toHaveBeenCalled();
    expect(sub).toEqual({ unsubscribe: expect.any(Function) });
  });

  test('startWatchingLocation requests permission when missing and proceeds if granted', async () => {
    const Location = require('expo-location');
    Location.getForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    Location.watchPositionAsync.mockResolvedValue('sub');

    const path = require('node:path');
    const { startWatchingLocation } = require(path.join(__dirname, '..', '..', 'utils', 'locationUtils.ts'));
    const sub = await startWatchingLocation(() => {});
    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
    expect(Location.watchPositionAsync).toHaveBeenCalled();
    expect(sub).toBe('sub');
  });

  test('startWatchingLocation returns null when permission denied', async () => {
    const Location = require('expo-location');
    Location.getForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });

    const path = require('node:path');
    const { startWatchingLocation } = require(path.join(__dirname, '..', '..', 'utils', 'locationUtils.ts'));
    const sub = await startWatchingLocation(() => {});
    expect(Location.watchPositionAsync).not.toHaveBeenCalled();
    expect(sub).toBeNull();
  });

  test('startWatchingLocation returns null on watchPositionAsync error', async () => {
    jest.spyOn(console, 'warn').mockImplementation(jest.fn());
    const Location = require('expo-location');
    Location.getForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    Location.watchPositionAsync.mockRejectedValue(new Error('boom'));

    const { startWatchingLocation } = require('../../utils/locationUtils.ts');
    const sub = await startWatchingLocation(() => {});
    expect(sub).toBeNull();
  });

  test('getInitialLocationFix returns last known when present', async () => {
    const Location = require('expo-location');
    const fix = { coords: { latitude: 1, longitude: 2 } };
    Location.getLastKnownPositionAsync.mockResolvedValue(fix);

    const { getInitialLocationFix } = require('../../utils/locationUtils.ts');
    await expect(getInitialLocationFix()).resolves.toBe(fix);
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  test('getInitialLocationFix falls back to getCurrentPositionAsync', async () => {
    const Location = require('expo-location');
    Location.getLastKnownPositionAsync.mockResolvedValue(null);
    const fix = { coords: { latitude: 3, longitude: 4 } };
    Location.getCurrentPositionAsync.mockResolvedValue(fix);

    const { getInitialLocationFix } = require('../../utils/locationUtils.ts');
    await expect(getInitialLocationFix()).resolves.toBe(fix);
  });

  test('getInitialLocationFix retries with lower accuracy then returns null', async () => {
    jest.useFakeTimers();
    const Location = require('expo-location');
    Location.getLastKnownPositionAsync.mockResolvedValue(null);
    Location.getCurrentPositionAsync.mockRejectedValue(new Error('no fix'));

    const { getInitialLocationFix } = require('../../utils/locationUtils.ts');
    const promise = getInitialLocationFix();
    await jest.runAllTimersAsync();
    await expect(promise).resolves.toBeNull();
    expect(Location.getCurrentPositionAsync).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  test('isPointInPolygon detects inside and outside points', () => {
    const path = require('node:path');
    const { isPointInPolygon } = require(path.join(__dirname, '..', '..', 'utils', 'locationUtils.ts'));
    // polygon as [lng, lat] pairs for a unit square from (1,1) to (2,2)
    const poly = [
      [1, 1],
      [2, 1],
      [2, 2],
      [1, 2],
    ];

    expect(isPointInPolygon(1.5, 1.5, poly)).toBeTruthy();
    expect(isPointInPolygon(0, 0, poly)).toBeFalsy();
  });

  test('isPointInPolygon works with triangle', () => {
    const { isPointInPolygon } = require('../../utils/locationUtils.ts');
    const poly = [
      [0, 0],
      [2, 0],
      [1, 2],
    ];

    expect(isPointInPolygon(1, 1, poly)).toBeTruthy();
    expect(isPointInPolygon(3, 1, poly)).toBeFalsy();
  });

  test('findUserBuilding returns code for point inside polygon and null otherwise', () => {
    const path = require('node:path');
    const { findUserBuilding } = require(path.join(__dirname, '..', '..', 'utils', 'locationUtils.ts'));
    const feature = {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [[ [1,1],[2,1],[2,2],[1,2],[1,1] ]] },
      properties: { code: 'X1' },
    };
    const fc = { type: 'FeatureCollection', features: [feature] };

    expect(findUserBuilding(1.5, 1.5, fc)).toBe('X1');
    expect(findUserBuilding(0, 0, fc)).toBeNull();
  });

  test('findUserBuilding returns null when feature has no code', () => {
    const { findUserBuilding } = require('../../utils/locationUtils.ts');
    const feature = {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [[ [1,1],[2,1],[2,2],[1,2],[1,1] ]] },
      properties: {},
    };
    const fc = { type: 'FeatureCollection', features: [feature] };

    expect(findUserBuilding(1.5, 1.5, fc)).toBeNull();
  });

  test('findUserBuilding skips non-Polygon features', () => {
    const { findUserBuilding } = require('../../utils/locationUtils.ts');
    const feature = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [1.5, 1.5] },
      properties: { code: 'X1' },
    };
    const fc = { type: 'FeatureCollection', features: [feature] };

    expect(findUserBuilding(1.5, 1.5, fc)).toBeNull();
  });
});
