const {
  __indoorDirectionsTestUtils,
} = require("../../utils/indoorDirections");

const {
  getFloorQuery,
  buildGraph,
  dijkstra,
  formatFloorLabel,
  getNearestRoomLabel,
  getArrivalRelationFromDisplayedApproach,
  simplifyPathForSteps,
  buildSteps,
} = __indoorDirectionsTestUtils;

function createNode(overrides = {}) {
  return {
    id: "node",
    type: "hallway",
    buildingId: "A",
    floor: 1,
    x: 0,
    y: 0,
    accessible: true,
    ...overrides,
  };
}

describe("indoorDirections internals", () => {
  test("maps MB S2 floor queries onto MB-S2 nodes on floor 1", () => {
    const s2Query = getFloorQuery("MB", -2);
    const hallQuery = getFloorQuery("H", 9);

    expect(s2Query.targetFloor).toBe(1);
    expect(
      s2Query.matchesNode(createNode({ buildingId: "MB-S2", floor: 1 })),
    ).toBe(true);
    expect(
      s2Query.matchesNode(createNode({ buildingId: "MB", floor: 1 })),
    ).toBe(false);

    expect(hallQuery.targetFloor).toBe(9);
    expect(
      hallQuery.matchesNode(createNode({ buildingId: "Hall", floor: 9 })),
    ).toBe(true);
  });

  test("connects matching vertical transit nodes across floors when building the graph", () => {
    const lowerElevator = createNode({
      id: "A_F1_elevator_door_1",
      type: "elevator_door",
      floor: 1,
    });
    const upperElevator = createNode({
      id: "A_F2_elevator_door_1",
      type: "elevator_door",
      floor: 2,
    });

    const { adjacency } = buildGraph([
      { nodes: [lowerElevator], edges: [] },
      { nodes: [upperElevator], edges: [] },
    ]);

    expect(adjacency.get(lowerElevator.id)).toContainEqual({
      neighbor: upperElevator.id,
      weight: 500,
    });
    expect(adjacency.get(upperElevator.id)).toContainEqual({
      neighbor: lowerElevator.id,
      weight: 500,
    });
  });

  test("applies building restrictions and vertical-transit exclusions during pathfinding", () => {
    const start = createNode({ id: "start", type: "room" });
    const elevator = createNode({ id: "elevator", type: "elevator_door" });
    const destination = createNode({
      id: "destination",
      type: "room",
      buildingId: "B",
    });

    const nodes = new Map([
      [start.id, start],
      [elevator.id, elevator],
      [destination.id, destination],
    ]);
    const adjacency = new Map([
      [start.id, [{ neighbor: elevator.id, weight: 5 }]],
      [
        elevator.id,
        [
          { neighbor: start.id, weight: 5 },
          { neighbor: destination.id, weight: 5 },
        ],
      ],
      [destination.id, [{ neighbor: elevator.id, weight: 5 }]],
    ]);

    expect(
      dijkstra(nodes, adjacency, start.id, destination.id, 1, "A", false),
    ).toBeNull();
    expect(
      dijkstra(nodes, adjacency, start.id, destination.id, 1, null, true),
    ).toBeNull();
    expect(
      dijkstra(nodes, adjacency, start.id, destination.id, 1, null, false),
    ).toEqual({
      path: ["start", "elevator", "destination"],
      distance: 10,
    });
  });

  test("formats S2 floors, filters MB landmarks correctly, and handles zero-length arrival vectors", () => {
    const current = createNode({
      id: "current",
      buildingId: "MB-S2",
      x: 0,
      y: 0,
    });
    const floorNodes = [
      current,
      createNode({
        id: "mb",
        type: "room",
        label: "MB-1.210",
        buildingId: "MB",
        x: 1,
      }),
      createNode({
        id: "s2",
        type: "room",
        label: "MB-S2.210",
        buildingId: "MB-S2",
        x: 2,
      }),
    ];

    expect(
      formatFloorLabel(createNode({ buildingId: "MB", floor: -2 })),
    ).toBe("S2");
    expect(
      getNearestRoomLabel(current, floorNodes, new Set(), 10, null),
    ).toBe("MB-S2.210");
    expect(
      getNearestRoomLabel(current, floorNodes, new Set(), 10, "MB"),
    ).toBe("MB-1.210");
    expect(
      getArrivalRelationFromDisplayedApproach(
        createNode({ x: 0, y: 0 }),
        createNode({ x: 0, y: 0 }),
      ),
    ).toBe("right");
  });

  test("preserves short paths and keeps explicit floor transitions during simplification", () => {
    const shortPath = simplifyPathForSteps(
      [
        createNode({ id: "a", type: "room" }),
        createNode({ id: "b", type: "room", x: 10 }),
      ],
      [0, 10],
    );

    expect(shortPath.distances).toEqual([0, 10]);
    expect(shortPath.nodes.map((node) => node.id)).toEqual(["a", "b"]);

    const floorChangePath = simplifyPathForSteps(
      [
        createNode({ id: "start", type: "room", floor: 1 }),
        createNode({ id: "middle", type: "hallway", floor: 2 }),
        createNode({ id: "end", type: "room", floor: 3 }),
      ],
      [0, 10, 20],
    );

    expect(floorChangePath.nodes.map((node) => node.id)).toEqual([
      "start",
      "middle",
      "end",
    ]);
  });

  test("builds empty, single-node, and pass-through-floor step sequences", () => {
    expect(buildSteps([], [], new Map(), [])).toEqual([]);

    const singleNode = buildSteps(
      [createNode({ id: "start", type: "room", label: "A" })],
      [0],
      new Map(),
      [],
    );

    expect(singleNode).toEqual([
      { instruction: "Start at room A.", floor: 1 },
    ]);

    const passThroughNodes = [
      createNode({ id: "start", type: "room", label: "A", floor: 1 }),
      createNode({ id: "stair1", type: "stair_landing", floor: 1, y: 100 }),
      createNode({ id: "stair2", type: "stair_landing", floor: 2, y: 100 }),
      createNode({ id: "stair3", type: "stair_landing", floor: 3, y: 100 }),
      createNode({ id: "dest", type: "room", label: "C", floor: 3, y: 150 }),
    ];

    expect(
      buildSteps(
        passThroughNodes,
        [0, 100, 200, 300, 350],
        new Map(),
        passThroughNodes,
      ),
    ).toEqual([
      { instruction: "Start at room A.", floor: 1 },
      {
        instruction: "Walk about 6 m, then take the stairs to floor 3.",
        floor: 3,
      },
      { instruction: "Continue for about 1 m.", floor: 3 },
      { instruction: "Room C will be straight ahead.", floor: 3 },
    ]);
  });

  test("emits a direct floor-stop instruction when the route reaches a room on the next floor", () => {
    const floorStopNodes = [
      createNode({ id: "start", type: "room", label: "A" }),
      createNode({ id: "stair1", type: "stair_landing", floor: 1, y: 100 }),
      createNode({ id: "stair2", type: "stair_landing", floor: 2, y: 100 }),
      createNode({ id: "dest", type: "room", label: "B", floor: 2, y: 150 }),
    ];

    expect(
      buildSteps(
        floorStopNodes,
        [0, 100, 200, 250],
        new Map(),
        floorStopNodes,
      ),
    ).toEqual([
      { instruction: "Start at room A.", floor: 1 },
      {
        instruction: "Walk about 4 m, then take the stairs to floor 2.",
        floor: 2,
      },
      { instruction: "Continue for about 1 m.", floor: 2 },
      { instruction: "Room B will be straight ahead.", floor: 2 },
    ]);
  });

  test("folds a short final approach into the turn that leads to the destination", () => {
    const foldedTurnNodes = [
      createNode({ id: "start", type: "room", label: "A" }),
      createNode({ id: "hall1", type: "hallway", x: 100, y: 0 }),
      createNode({ id: "turn", type: "hallway", x: 100, y: 100 }),
      createNode({ id: "dest", type: "room", label: "B", x: 100, y: 150 }),
    ];

    expect(
      buildSteps(
        foldedTurnNodes,
        [0, 100, 200, 250],
        new Map(),
        foldedTurnNodes,
      ),
    ).toEqual([
      { instruction: "Start at room A.", floor: 1 },
      { instruction: "Continue straight for about 2 m.", floor: 1 },
      { instruction: "Turn right and continue for about 3 m.", floor: 1 },
      { instruction: "Room B will be straight ahead.", floor: 1 },
    ]);
  });
});
