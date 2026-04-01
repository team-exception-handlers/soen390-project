import {
    ALL_POI_CATEGORIES,
    fetchNearbyPOIs,
    filterPOIsByDistance,
    formatDistance,
    getCategoryLabel,
    sortPOIsByDistance,
    type POIResult,
} from "../../utils/poiSearch";

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

const SGW_LOCATION = { latitude: 45.497, longitude: -73.578 };

const makePOI = (overrides: Partial<POIResult> = {}): POIResult => ({
  id: "1",
  name: "Test Place",
  category: "cafe",
  latitude: 45.498,
  longitude: -73.579,
  distance: 0.15,
  ...overrides,
});

describe("poiSearch", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("fetchNearbyPOIs", () => {
    it("fetches POIs from Overpass API and returns sorted results", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          elements: [
            {
              id: 100,
              lat: 45.498,
              lon: -73.579,
              tags: { name: "Cafe A", "addr:street": "Rue Guy" },
            },
            {
              id: 101,
              lat: 45.499,
              lon: -73.580,
              tags: { name: "Cafe B" },
            },
          ],
        }),
      });

      const results = await fetchNearbyPOIs(SGW_LOCATION, "cafe", 1000);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://overpass-api.de/api/interpreter",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }),
      );
      expect(results).toHaveLength(2);
      expect(results[0].name).toBe("Cafe A");
      expect(results[0].category).toBe("cafe");
      expect(results[0].address).toBe("Rue Guy");
      expect(typeof results[0].distance).toBe("number");
    });

    it("handles way elements with center coordinates", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          elements: [
            {
              id: 200,
              type: "way",
              center: { lat: 45.497, lon: -73.577 },
              tags: { name: "Restaurant X" },
            },
          ],
        }),
      });

      const results = await fetchNearbyPOIs(SGW_LOCATION, "restaurant", 1000);

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("Restaurant X");
      expect(results[0].latitude).toBe(45.497);
      expect(results[0].longitude).toBe(-73.577);
    });

    it("skips elements without valid coordinates", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          elements: [
            { id: 300, tags: { name: "No coords" } },
            { id: 301, lat: 45.498, lon: -73.578, tags: { name: "Valid" } },
          ],
        }),
      });

      const results = await fetchNearbyPOIs(SGW_LOCATION, "cafe", 1000);
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("Valid");
    });

    it("uses category label as fallback name when no name tag", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          elements: [
            { id: 400, lat: 45.498, lon: -73.578, tags: {} },
          ],
        }),
      });

      const results = await fetchNearbyPOIs(SGW_LOCATION, "pharmacy", 1000);
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("Pharmacy");
    });

    it("throws on API error", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      await expect(
        fetchNearbyPOIs(SGW_LOCATION, "cafe", 1000),
      ).rejects.toThrow("Overpass API error: 500");
    });

    it("returns empty array for empty response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ elements: [] }),
      });

      const results = await fetchNearbyPOIs(SGW_LOCATION, "cafe", 1000);
      expect(results).toEqual([]);
    });
  });

  describe("filterPOIsByDistance", () => {
    it("filters POIs within the max distance", () => {
      const pois = [
        makePOI({ id: "1", distance: 0.3 }),
        makePOI({ id: "2", distance: 0.8 }),
        makePOI({ id: "3", distance: 1.5 }),
        makePOI({ id: "4", distance: 2.0 }),
      ];

      const filtered = filterPOIsByDistance(pois, 1.0);
      expect(filtered).toHaveLength(2);
      expect(filtered.map((p) => p.id)).toEqual(["1", "2"]);
    });

    it("includes POIs exactly at the boundary", () => {
      const pois = [makePOI({ id: "1", distance: 1.0 })];
      const filtered = filterPOIsByDistance(pois, 1.0);
      expect(filtered).toHaveLength(1);
    });

    it("returns empty array when no POIs within range", () => {
      const pois = [makePOI({ id: "1", distance: 5.0 })];
      const filtered = filterPOIsByDistance(pois, 1.0);
      expect(filtered).toEqual([]);
    });
  });

  describe("sortPOIsByDistance", () => {
    it("sorts POIs by distance ascending", () => {
      const pois = [
        makePOI({ id: "1", distance: 1.5 }),
        makePOI({ id: "2", distance: 0.3 }),
        makePOI({ id: "3", distance: 0.8 }),
      ];

      const sorted = sortPOIsByDistance(pois);
      expect(sorted.map((p) => p.id)).toEqual(["2", "3", "1"]);
    });

    it("does not mutate the original array", () => {
      const pois = [
        makePOI({ id: "1", distance: 1.5 }),
        makePOI({ id: "2", distance: 0.3 }),
      ];
      const original = [...pois];

      sortPOIsByDistance(pois);
      expect(pois).toEqual(original);
    });
  });

  describe("formatDistance", () => {
    it("formats distances under 1km in meters", () => {
      expect(formatDistance(0.15)).toBe("150 m");
      expect(formatDistance(0.5)).toBe("500 m");
      expect(formatDistance(0.001)).toBe("1 m");
    });

    it("formats distances >= 1km with one decimal", () => {
      expect(formatDistance(1.0)).toBe("1.0 km");
      expect(formatDistance(2.5)).toBe("2.5 km");
      expect(formatDistance(10.123)).toBe("10.1 km");
    });
  });

  describe("getCategoryLabel", () => {
    it("returns correct label for each category", () => {
      expect(getCategoryLabel("restaurant")).toBe("Restaurant");
      expect(getCategoryLabel("cafe")).toBe("Coffee Shop");
      expect(getCategoryLabel("washroom")).toBe("Washroom");
      expect(getCategoryLabel("pharmacy")).toBe("Pharmacy");
      expect(getCategoryLabel("library")).toBe("Library");
      expect(getCategoryLabel("gym")).toBe("Gym");
      expect(getCategoryLabel("bank")).toBe("Bank");
      expect(getCategoryLabel("grocery")).toBe("Grocery");
    });
  });

  describe("ALL_POI_CATEGORIES", () => {
    it("contains all 8 categories", () => {
      expect(ALL_POI_CATEGORIES).toHaveLength(8);
      expect(ALL_POI_CATEGORIES).toContain("restaurant");
      expect(ALL_POI_CATEGORIES).toContain("cafe");
      expect(ALL_POI_CATEGORIES).toContain("washroom");
      expect(ALL_POI_CATEGORIES).toContain("pharmacy");
      expect(ALL_POI_CATEGORIES).toContain("library");
      expect(ALL_POI_CATEGORIES).toContain("gym");
      expect(ALL_POI_CATEGORIES).toContain("bank");
      expect(ALL_POI_CATEGORIES).toContain("grocery");
    });
  });
});
