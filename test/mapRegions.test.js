describe('utils/mapRegions', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('returns default region when no buildings for campus', () => {
    jest.doMock('../constants/buildings', () => ({ BUILDINGS: [] }));
    const { getCampusRegion } = require('../utils/mapRegions.ts');

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
    jest.doMock('../constants/buildings', () => ({ BUILDINGS: buildings }));
    const { getCampusRegion } = require('../utils/mapRegions.ts');

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
    jest.doMock('../constants/buildings', () => ({ BUILDINGS: buildings }));
    const { getCampusRegion } = require('../utils/mapRegions.ts');

    const region = getCampusRegion('LOY');

    expect(region.latitude).toBeCloseTo(45.1);
    expect(region.longitude).toBeCloseTo(-73.1);
    expect(region.latitudeDelta).toBeCloseTo(0.005);
    expect(region.longitudeDelta).toBeCloseTo(0.005);
  });
});
