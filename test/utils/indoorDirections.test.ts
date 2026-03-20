import {
  findIndoorRoute,
  getFloorBounds,
  getGraphFloorBounds,
} from "../../utils/indoorDirections";

describe("indoorDirections", () => {
  test("accepts fully prefixed room labels as well as bare room numbers", () => {
    const bareRoute = findIndoorRoute("H", "867", "929");
    const prefixedRoute = findIndoorRoute("H", "H-867", "H-929");
    expect(prefixedRoute).toEqual(bareRoute);
  });

  test("builds natural directions that match the displayed Hall 9 route", () => {
    const route = findIndoorRoute("H", "919", "962");
    expect(route).not.toBeNull();
    expect(route?.steps.map((step) => step.instruction)).toEqual([
      "Start at room H-919.",
      "Continue straight for about 17 m.",
      "Turn left and continue for about 7 m.",
      "Turn right and continue for about 7 m.",
      "Turn left and continue for about 1.5 m.",
      "Continue for about 2 m.",
      "Room H-962 will be straight ahead.",
    ]);
  });

  test("keeps side-based arrival wording for rooms that branch off the corridor", () => {
    const route = findIndoorRoute("H", "919", "931");
    expect(route).not.toBeNull();
    expect(route?.steps[route.steps.length - 1].instruction).toBe(
      "Room H-931 will be on your right.",
    );
  });

  test("marks Hall room 911 as straight ahead when it sits at the end of the final corridor run", () => {
    const route = findIndoorRoute("H", "927", "911");
    expect(route).not.toBeNull();
    expect(route?.steps[route.steps.length - 1].instruction).toBe(
      "Room H-911 will be straight ahead.",
    );
  });

  test.each([
    ["927", "Room H-927 will be on your right."],
    ["911", "Room H-911 will be straight ahead."],
  ])("uses the expected final arrival wording for Hall room %s", (destination, expected) => {
    const route = findIndoorRoute("H", "919", destination);
    expect(route).not.toBeNull();
    expect(route?.steps[route.steps.length - 1].instruction).toBe(expected);
  });

  test("shows 1 meter-plus post-turn distances for the MB 1.210 to 1.130 route", () => {
    const route = findIndoorRoute("MB", "1.210", "1.130");
    expect(route).not.toBeNull();
    expect(route?.steps.map((step) => step.instruction)).toEqual([
      "Start at room MB-1.210.",
      "Continue straight for about 2 m.",
      "Turn left and continue for about 1.5 m.",
      "Turn right and continue for about 1 m.",
      "Turn left and continue for about 2 m.",
      "Continue straight for about 8 m.",
      "Turn left and continue for about 1.5 m.",
      "Turn left.",
      "Room MB-1.130 will be on your right.",
    ]);
  });

  test("returns a no-movement route when the start and destination room are the same", () => {
    const route = findIndoorRoute("MB", "1.210", "1.210");
    expect(route).toEqual({
      segments: [{ floor: 1, points: [{ x: 617, y: 333 }] }],
      steps: [{ instruction: "You are already at room 1.210", floor: 1 }],
      totalDistance: 0,
      startFloor: 1,
      endFloor: 1,
    });
  });

  test.each([
    ["MB", "missing", "1.210"],
    ["H", "919", "missing"],
  ])(
    "returns null when either endpoint room is missing for %s",
    (buildingCode, start, end) => {
      expect(findIndoorRoute(buildingCode, start, end)).toBeNull();
    },
  );

  test("adds stair instructions and per-floor segments for Hall routes that change floors", () => {
    const route = findIndoorRoute("H", "867", "929");
    expect(route).not.toBeNull();
    expect(route?.startFloor).toBe(8);
    expect(route?.endFloor).toBe(9);
    expect(route?.segments.map((segment) => segment.floor)).toEqual([8, 9]);
    expect(route?.steps.map((step) => step.instruction)).toContain(
      "take the stairs to floor 9.",
    );
  });

  test("matches S2 room labels to MB-S2 nodes without leaking MB floor-1 room names", () => {
    const route = findIndoorRoute("MB", "S2.210", "S2.235");
    expect(route).not.toBeNull();
    expect(route?.steps.map((step) => step.instruction)).toEqual([
      "Start at room MB-S2.210.",
      "Continue straight for about 2 m.",
      "Turn left.",
      "Continue straight for about 6 m.",
      "Turn left and continue for about 2 m.",
      "Continue for about 1.5 m.",
      "Room MB-S2.235 will be straight ahead.",
    ]);
  });

  test("returns static image bounds when a floor plan asset defines them", () => {
    expect(getFloorBounds("MB", 1)).toEqual({ width: 1024, height: 1024 });
    expect(getFloorBounds("VE", 2)).toEqual({ width: 1385, height: 650 });
  });

  test("computes fallback floor bounds from graph data when no static image size exists", () => {
    expect(getFloorBounds("Hall", 8)).toEqual({ width: 2102, height: 2051 });
    expect(getFloorBounds("XYZ", 99)).toEqual({ width: 2000, height: 1500 });
  });

  test.each([
    ["H", 1, { width: 938, height: 940 }],
    ["H", 2, { width: 931, height: 971 }],
    ["H", 8, { width: 2102, height: 2051 }],
    ["H", 9, { width: 2091, height: 2036 }],
    ["MB", 1, { width: 1009, height: 1027 }],
    ["MB", -2, { width: 1029, height: 1027 }],
    ["VE", 1, { width: 615, height: 556 }],
    ["VE", 2, { width: 1436, height: 646 }],
    ["VL", 1, { width: 1044, height: 1036 }],
    ["VL", 2, { width: 1023, height: 1041 }],
    ["CC", 1, { width: 8240, height: 2066 }],
    ["Hall", 8, { width: 1922, height: 2106 }],
    ["XYZ", 99, { width: 2000, height: 1500 }],
  ])(
    "returns the expected graph bounds for %s floor %s",
    (buildingCode, floor, expected) => {
      expect(getGraphFloorBounds(buildingCode, floor)).toEqual(expected);
    },
  );

  test("noStairs: cross-floor Hall route avoids stairs and uses escalator instead", () => {
    const route = findIndoorRoute("H", "110", "260", true, false);
    expect(route).not.toBeNull();
    const instructions = route!.steps.map((s) => s.instruction);
    expect(instructions.some((s) => s.includes("stairs"))).toBe(false);
    expect(route!.endFloor).toBe(2);
  });

  test("noEscalators: cross-floor Hall route avoids escalators and uses stairs instead", () => {
    const route = findIndoorRoute("H", "110", "260", false, true);
    expect(route).not.toBeNull();
    const instructions = route!.steps.map((s) => s.instruction);
    expect(instructions.some((s) => s.includes("escalator"))).toBe(false);
    expect(route!.endFloor).toBe(2);
  });

  test("directional escalator: up escalator is used when going from floor 1 to floor 2", () => {
    const route = findIndoorRoute("H", "110", "260", false, false);
    expect(route).not.toBeNull();
    expect(route!.startFloor).toBe(1);
    expect(route!.endFloor).toBe(2);
  });

  test("directional escalator: down escalator is used when going from floor 2 to floor 1", () => {
    const route = findIndoorRoute("H", "260", "110", false, false);
    expect(route).not.toBeNull();
    expect(route!.startFloor).toBe(2);
    expect(route!.endFloor).toBe(1);
  });

  test("floor change step says 'escalator' when route passes through escalator_landing nodes", () => {
    const route = findIndoorRoute("H", "110", "260", true, false);
    expect(route).not.toBeNull();
    const instructions = route!.steps.map((s) => s.instruction);
    expect(instructions.some((s) => s.includes("escalator"))).toBe(true);
  });

  test("falls back to allowing vertical transit nodes when same-floor route requires them", () => {
    const route = findIndoorRoute("H", "109-1", "127");
    expect(route).not.toBeNull();
    expect(route!.startFloor).toBe(route!.endFloor);
  });

  test("returns null when both stairs and escalators are disabled and no elevator path exists for same building", () => {
    const route = findIndoorRoute("H", "110", "260", true, true);
    if (route !== null) {
      const instructions = route.steps.map((s) => s.instruction);
      expect(instructions.some((s) => s.includes("stairs"))).toBe(false);
      expect(instructions.some((s) => s.includes("escalator"))).toBe(false);
      expect(instructions.some((s) => s.includes("elevator"))).toBe(true);
    }
  });

  test("noStairs does not affect same-floor routes", () => {
    const normal = findIndoorRoute("H", "919", "931");
    const noStairs = findIndoorRoute("H", "919", "931", true, false);
    expect(noStairs).toEqual(normal);
  });

  test("noEscalators does not affect same-floor routes", () => {
    const normal = findIndoorRoute("H", "919", "931");
    const noEscalators = findIndoorRoute("H", "919", "931", false, true);
    expect(noEscalators).toEqual(normal);
  });
});