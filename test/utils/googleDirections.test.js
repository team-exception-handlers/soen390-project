const path = require('node:path');
const { buildDirectionsUrl, fetchDirections } = require(path.join(__dirname, '..', '..', 'utils', 'googleDirections.ts'));

describe('utils/googleDirections', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  test('buildDirectionsUrl with coordinates and options', () => {
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = 'API_KEY';

    const origin = { latitude: 1, longitude: 2 };
    const destination = { latitude: 3, longitude: 4 };

    const url = buildDirectionsUrl(origin, destination, {
      mode: 'walking',
      language: 'en',
      region: 'us',
    });

    const parsed = new URL(url);
    const params = parsed.searchParams;

    expect(parsed.origin + parsed.pathname).toBe('https://maps.googleapis.com/maps/api/directions/json');
    expect(params.get('origin')).toBe('1,2');
    expect(params.get('destination')).toBe('3,4');
    expect(params.get('key')).toBe('API_KEY');
    expect(params.get('mode')).toBe('walking');
    expect(params.get('language')).toBe('en');
    expect(params.get('region')).toBe('us');
  });

  test('buildDirectionsUrl accepts string locations', () => {
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = 'K';
    const url = buildDirectionsUrl('Origin Address', 'Destination Address');
    const parsed = new URL(url);
    const params = parsed.searchParams;
    expect(params.get('origin')).toBe('Origin Address');
    expect(params.get('destination')).toBe('Destination Address');
  });

  test('buildDirectionsUrl throws on invalid location object', () => {
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = 'K';
    expect(() => buildDirectionsUrl({ foo: 1 }, { latitude: 1, longitude: 2 })).toThrow(
      'Invalid location format for directions request.',
    );
  });

  test('fetchDirections calls fetch and returns json', async () => {
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = 'K';

    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ routes: [] }),
    });

    const data = await fetchDirections({ latitude: 1, longitude: 2 }, { latitude: 3, longitude: 4 });
    expect(globalThis.fetch).toHaveBeenCalled();
    expect(data).toEqual({ routes: [] });
  });

  test('fetchDirections throws when response not ok', async () => {
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = 'K';
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });
    await expect(fetchDirections('A', 'B')).rejects.toThrow('Directions API request failed with 500.');
  });
});
