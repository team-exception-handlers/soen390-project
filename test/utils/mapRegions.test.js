describe('utils/mapRegions', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('returns default region when no buildings for campus', () => {
    const path = require('node:path');
    jest.doMock(require.resolve(path.join(__dirname, '..', '..', 'constants', 'buildings')),
      () => ({ BUILDINGS: [] }));
    const { getCampusRegion } = require(path.join(__dirname, '..', '..', 'utils', 'mapRegions.ts'));

    const region = getCampusRegion('SGW');

    expect(region).toEqual({
      latitude: 45.4967,
      longitude: -73.5799,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    });
  });

  test('computes center and deltas for campus buildings', () => {
    const buildings = [
      { campus: 'SGW', latitude: 45, longitude: -73 },
      { campus: 'SGW', latitude: 46, longitude: -72 },
    ];
    const path = require('node:path');
    jest.doMock(require.resolve(path.join(__dirname, '..', '..', 'constants', 'buildings')),
      () => ({ BUILDINGS: buildings }));
    const { getCampusRegion } = require(path.join(__dirname, '..', '..', 'utils', 'mapRegions.ts'));

    const region = getCampusRegion('SGW');

    expect(region.latitude).toBeCloseTo(45.5);
    expect(region.longitude).toBeCloseTo(-72.5);
    expect(region.latitudeDelta).toBeCloseTo(1.4);
    expect(region.longitudeDelta).toBeCloseTo(1.4);
  });

  test('uses minimum delta when bounds are identical', () => {
    const buildings = [
      { campus: 'LOY', latitude: 45.1, longitude: -73.1 },
      { campus: 'LOY', latitude: 45.1, longitude: -73.1 },
    ];
    const path = require('node:path');
    jest.doMock(require.resolve(path.join(__dirname, '..', '..', 'constants', 'buildings')),
      () => ({ BUILDINGS: buildings }));
    const { getCampusRegion } = require(path.join(__dirname, '..', '..', 'utils', 'mapRegions.ts'));

    const region = getCampusRegion('LOY');

    expect(region.latitude).toBeCloseTo(45.1);
    expect(region.longitude).toBeCloseTo(-73.1);
    expect(region.latitudeDelta).toBeCloseTo(0.005);
    expect(region.longitudeDelta).toBeCloseTo(0.005);
  });

  test('filters buildings by polygon features when provided', () => {
    const buildings = [
      { code: 'A1', campus: 'SGW', latitude: 45, longitude: -73 },
      { code: 'A2', campus: 'SGW', latitude: 46, longitude: -72 },
      { code: 'B1', campus: 'SGW', latitude: 47, longitude: -71 },
    ];
    const path = require('node:path');
    jest.doMock(require.resolve(path.join(__dirname, '..', '..', 'constants', 'buildings')),
      () => ({ BUILDINGS: buildings }));
    const { getCampusRegion } = require(path.join(__dirname, '..', '..', 'utils', 'mapRegions.ts'));

    const polygonFeatures = [
      { properties: { code: 'A1' } },
      { properties: { code: 'A2' } },
    ];

    const region = getCampusRegion('SGW', polygonFeatures);

    // Region should center on A1 and A2 only, not B1
    expect(region.latitude).toBeCloseTo(45.5);
    expect(region.longitude).toBeCloseTo(-72.5);
  });

  test('matches buildings by parent code prefix', () => {
    const buildings = [
      { code: 'A10', campus: 'SGW', latitude: 45, longitude: -73 },
      { code: 'A12', campus: 'SGW', latitude: 46, longitude: -72 },
    ];
    const path = require('node:path');
    jest.doMock(require.resolve(path.join(__dirname, '..', '..', 'constants', 'buildings')),
      () => ({ BUILDINGS: buildings }));
    const { getCampusRegion } = require(path.join(__dirname, '..', '..', 'utils', 'mapRegions.ts'));

    // Polygon feature 'A' (length 1, too short) should NOT match
    const polygonFeatures1 = [{ properties: { code: 'A' } }];
    const region1 = getCampusRegion('SGW', polygonFeatures1);
    expect(region1).toEqual({
      latitude: 45.4967,
      longitude: -73.5799,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    });

    // Polygon feature 'A1' (length 2) should match both A10 and A12
    const polygonFeatures2 = [{ properties: { code: 'A1' } }];
    const region2 = getCampusRegion('SGW', polygonFeatures2);
    expect(region2.latitude).toBeCloseTo(45.5);
    expect(region2.longitude).toBeCloseTo(-72.5);
  });

  test('returns default region when polygon features provided but no buildings match', () => {
    const buildings = [
      { code: 'A1', campus: 'SGW', latitude: 45, longitude: -73 },
    ];
    const path = require('node:path');
    jest.doMock(require.resolve(path.join(__dirname, '..', '..', 'constants', 'buildings')),
      () => ({ BUILDINGS: buildings }));
    const { getCampusRegion } = require(path.join(__dirname, '..', '..', 'utils', 'mapRegions.ts'));

    const polygonFeatures = [{ properties: { code: 'B1' } }];

    const region = getCampusRegion('SGW', polygonFeatures);

    expect(region).toEqual({
      latitude: 45.4967,
      longitude: -73.5799,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    });
  });

  test('applies LOY campus padding multiplier (1.1x)', () => {
    const buildings = [
      { campus: 'LOY', latitude: 45, longitude: -73 },
      { campus: 'LOY', latitude: 46, longitude: -72 },
    ];
    const path = require('node:path');
    jest.doMock(require.resolve(path.join(__dirname, '..', '..', 'constants', 'buildings')),
      () => ({ BUILDINGS: buildings }));
    const { getCampusRegion } = require(path.join(__dirname, '..', '..', 'utils', 'mapRegions.ts'));

    const region = getCampusRegion('LOY');

    // Base delta is 1.0, LOY multiplier is 1.1, so expect 1.1
    expect(region.latitudeDelta).toBeCloseTo(1.1);
    expect(region.longitudeDelta).toBeCloseTo(1.1);
  });

  test('handles single building', () => {
    const buildings = [
      { campus: 'SGW', latitude: 45.5, longitude: -73.5 },
    ];
    const path = require('node:path');
    jest.doMock(require.resolve(path.join(__dirname, '..', '..', 'constants', 'buildings')),
      () => ({ BUILDINGS: buildings }));
    const { getCampusRegion } = require(path.join(__dirname, '..', '..', 'utils', 'mapRegions.ts'));

    const region = getCampusRegion('SGW');

    expect(region.latitude).toBe(45.5);
    expect(region.longitude).toBe(-73.5);
    // Min delta is 0.005
    expect(region.latitudeDelta).toBe(0.005);
    expect(region.longitudeDelta).toBe(0.005);
  });

  test('returns default region when no campus matches', () => {
    const buildings = [
      { campus: 'SGW', latitude: 45, longitude: -73 },
    ];
    const path = require('node:path');
    jest.doMock(require.resolve(path.join(__dirname, '..', '..', 'constants', 'buildings')),
      () => ({ BUILDINGS: buildings }));
    const { getCampusRegion } = require(path.join(__dirname, '..', '..', 'utils', 'mapRegions.ts'));

    const region = getCampusRegion('LOY');

    expect(region).toEqual({
      latitude: 45.4967,
      longitude: -73.5799,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    });
  });

  test('handles empty polygon features array', () => {
    const buildings = [
      { code: 'A1', campus: 'SGW', latitude: 45, longitude: -73 },
      { code: 'A2', campus: 'SGW', latitude: 46, longitude: -72 },
    ];
    const path = require('node:path');
    jest.doMock(require.resolve(path.join(__dirname, '..', '..', 'constants', 'buildings')),
      () => ({ BUILDINGS: buildings }));
    const { getCampusRegion } = require(path.join(__dirname, '..', '..', 'utils', 'mapRegions.ts'));

    // Empty array should not filter
    const region = getCampusRegion('SGW', []);

    // Should use all SGW buildings (A1 and A2)
    expect(region.latitude).toBeCloseTo(45.5);
    expect(region.longitude).toBeCloseTo(-72.5);
  });
});
