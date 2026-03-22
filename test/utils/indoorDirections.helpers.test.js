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
  addBidirectionalEdge,
  isEscalatorEdge,
  resolveDirectionalEscalator,
  processEdge,
  connectVerticalNodesBySuffix,
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

describe("refactored buildGraph helpers", () => {
  test("addBidirectionalEdge pushes edges in both directions", () => {
    const adjacency = new Map([
      ["a", []],
      ["b", []],
    ]);

    addBidirectionalEdge(adjacency, "a", "b", 42);

    expect(adjacency.get("a")).toContainEqual({ neighbor: "b", weight: 42 });
    expect(adjacency.get("b")).toContainEqual({ neighbor: "a", weight: 42 });
  });

  test("isEscalatorEdge returns true for escalator edge type", () => {
    const allNodes = new Map();
    const edge = { type: "escalator", source: "x", target: "y", weight: 1 };

    expect(isEscalatorEdge(edge, allNodes)).toBe(true);
  });

  test("isEscalatorEdge returns true when source node is escalator_landing", () => {
    const src = createNode({ id: "src", type: "escalator_landing" });
    const tgt = createNode({ id: "tgt", type: "hallway" });
    const allNodes = new Map([
      [src.id, src],
      [tgt.id, tgt],
    ]);
    const edge = { type: "stair", source: "src", target: "tgt", weight: 1 };

    expect(isEscalatorEdge(edge, allNodes)).toBe(true);
  });

  test("isEscalatorEdge returns true when target node is escalator_landing", () => {
    const src = createNode({ id: "src", type: "hallway" });
    const tgt = createNode({ id: "tgt", type: "escalator_landing" });
    const allNodes = new Map([
      [src.id, src],
      [tgt.id, tgt],
    ]);
    const edge = { type: "stair", source: "src", target: "tgt", weight: 1 };

    expect(isEscalatorEdge(edge, allNodes)).toBe(true);
  });

  test("isEscalatorEdge returns false for plain stair edge with non-escalator nodes", () => {
    const src = createNode({ id: "src", type: "stair_landing" });
    const tgt = createNode({ id: "tgt", type: "stair_landing" });
    const allNodes = new Map([
      [src.id, src],
      [tgt.id, tgt],
    ]);
    const edge = { type: "stair", source: "src", target: "tgt", weight: 1 };

    expect(isEscalatorEdge(edge, allNodes)).toBe(false);
  });

  describe("resolveDirectionalEscalator", () => {
    function makeAdjacency(...ids) {
      return new Map(ids.map((id) => [id, []]));
    }

    test("routes upward escalator from lower to upper floor", () => {
      const lower = createNode({ id: "lower", type: "escalator_landing", floor: 1, direction: "up" });
      const upper = createNode({ id: "upper", type: "escalator_landing", floor: 2, direction: "up" });
      const allNodes = new Map([
        [lower.id, lower],
        [upper.id, upper],
      ]);
      const adjacency = makeAdjacency("lower", "upper");
      const edge = { source: "lower", target: "upper", weight: 10 };

      const handled = resolveDirectionalEscalator(edge, allNodes, adjacency);

      expect(handled).toBe(true);
      expect(adjacency.get("lower")).toContainEqual({ neighbor: "upper", weight: 10 });
      expect(adjacency.get("upper")).toHaveLength(0);
    });

    test("routes downward escalator from upper to lower floor", () => {
      const lower = createNode({ id: "lower", type: "escalator_landing", floor: 1, direction: "down" });
      const upper = createNode({ id: "upper", type: "escalator_landing", floor: 2, direction: "down" });
      const allNodes = new Map([
        [lower.id, lower],
        [upper.id, upper],
      ]);
      const adjacency = makeAdjacency("lower", "upper");
      const edge = { source: "lower", target: "upper", weight: 10 };

      const handled = resolveDirectionalEscalator(edge, allNodes, adjacency);

      expect(handled).toBe(true);
      expect(adjacency.get("upper")).toContainEqual({ neighbor: "lower", weight: 10 });
      expect(adjacency.get("lower")).toHaveLength(0);
    });

    test("returns false and adds no edges when no direction is set", () => {
      const src = createNode({ id: "src", type: "escalator_landing", floor: 1 });
      const tgt = createNode({ id: "tgt", type: "escalator_landing", floor: 2 });
      const allNodes = new Map([
        [src.id, src],
        [tgt.id, tgt],
      ]);
      const adjacency = makeAdjacency("src", "tgt");
      const edge = { source: "src", target: "tgt", weight: 10 };

      const handled = resolveDirectionalEscalator(edge, allNodes, adjacency);

      expect(handled).toBe(false);
      expect(adjacency.get("src")).toHaveLength(0);
      expect(adjacency.get("tgt")).toHaveLength(0);
    });

    test("resolves correctly regardless of which node carries the direction", () => {
      // direction on target node, not source
      const lower = createNode({ id: "lower", type: "escalator_landing", floor: 1 });
      const upper = createNode({ id: "upper", type: "escalator_landing", floor: 2, direction: "up" });
      const allNodes = new Map([
        [lower.id, lower],
        [upper.id, upper],
      ]);
      const adjacency = makeAdjacency("lower", "upper");
      const edge = { source: "lower", target: "upper", weight: 5 };

      resolveDirectionalEscalator(edge, allNodes, adjacency);

      expect(adjacency.get("lower")).toContainEqual({ neighbor: "upper", weight: 5 });
    });
  });

  describe("processEdge", () => {
    function makeSetup(...ids) {
      const allNodes = new Map();
      const adjacency = new Map(ids.map((id) => [id, []]));
      return { allNodes, adjacency };
    }

    test("adds bidirectional edge for non-vertical edge types", () => {
      const { allNodes, adjacency } = makeSetup("a", "b");
      const edge = { type: "hallway", source: "a", target: "b", weight: 3 };

      processEdge(edge, allNodes, adjacency, false, false, false);

      expect(adjacency.get("a")).toContainEqual({ neighbor: "b", weight: 3 });
      expect(adjacency.get("b")).toContainEqual({ neighbor: "a", weight: 3 });
    });

    test("skips elevator edge when noElevators is true", () => {
      const { allNodes, adjacency } = makeSetup("a", "b");
      const edge = { type: "elevator", source: "a", target: "b", weight: 5 };

      processEdge(edge, allNodes, adjacency, false, false, true);

      expect(adjacency.get("a")).toHaveLength(0);
      expect(adjacency.get("b")).toHaveLength(0);
    });

    test("adds bidirectional edge for elevator when noElevators is false", () => {
      const { allNodes, adjacency } = makeSetup("a", "b");
      const edge = { type: "elevator", source: "a", target: "b", weight: 5 };

      processEdge(edge, allNodes, adjacency, false, false, false);

      expect(adjacency.get("a")).toContainEqual({ neighbor: "b", weight: 5 });
      expect(adjacency.get("b")).toContainEqual({ neighbor: "a", weight: 5 });
    });

    test("skips stair edge when noStairs is true", () => {
      const src = createNode({ id: "src", type: "stair_landing" });
      const tgt = createNode({ id: "tgt", type: "stair_landing" });
      const allNodes = new Map([[src.id, src], [tgt.id, tgt]]);
      const adjacency = new Map([["src", []], ["tgt", []]]);
      const edge = { type: "stair", source: "src", target: "tgt", weight: 5 };

      processEdge(edge, allNodes, adjacency, true, false, false);

      expect(adjacency.get("src")).toHaveLength(0);
      expect(adjacency.get("tgt")).toHaveLength(0);
    });

    test("skips escalator edge when noEscalators is true", () => {
      const src = createNode({ id: "src", type: "escalator_landing" });
      const tgt = createNode({ id: "tgt", type: "escalator_landing" });
      const allNodes = new Map([[src.id, src], [tgt.id, tgt]]);
      const adjacency = new Map([["src", []], ["tgt", []]]);
      const edge = { type: "escalator", source: "src", target: "tgt", weight: 5 };

      processEdge(edge, allNodes, adjacency, false, true, false);

      expect(adjacency.get("src")).toHaveLength(0);
      expect(adjacency.get("tgt")).toHaveLength(0);
    });

    test("handles directional escalator as one-way via resolveDirectionalEscalator", () => {
      const src = createNode({ id: "src", type: "escalator_landing", floor: 1, direction: "up" });
      const tgt = createNode({ id: "tgt", type: "escalator_landing", floor: 2, direction: "up" });
      const allNodes = new Map([[src.id, src], [tgt.id, tgt]]);
      const adjacency = new Map([["src", []], ["tgt", []]]);
      const edge = { type: "escalator", source: "src", target: "tgt", weight: 7 };

      processEdge(edge, allNodes, adjacency, false, false, false);

      expect(adjacency.get("src")).toContainEqual({ neighbor: "tgt", weight: 7 });
      expect(adjacency.get("tgt")).toHaveLength(0);
    });
  });

  describe("connectVerticalNodesBySuffix", () => {
    test("connects adjacent-floor stair nodes with the same suffix", () => {
      const lower = createNode({ id: "A_F1_stair_landing_1", type: "stair_landing", floor: 1 });
      const upper = createNode({ id: "A_F2_stair_landing_1", type: "stair_landing", floor: 2 });
      const nodes = new Map([[lower.id, lower], [upper.id, upper]]);
      const adjacency = new Map([[lower.id, []], [upper.id, []]]);

      connectVerticalNodesBySuffix(nodes, adjacency, false, false, false);

      expect(adjacency.get(lower.id)).toContainEqual({ neighbor: upper.id, weight: 500 });
      expect(adjacency.get(upper.id)).toContainEqual({ neighbor: lower.id, weight: 500 });
    });

    test("skips stair nodes when noStairs is true", () => {
      const lower = createNode({ id: "A_F1_stair_landing_1", type: "stair_landing", floor: 1 });
      const upper = createNode({ id: "A_F2_stair_landing_1", type: "stair_landing", floor: 2 });
      const nodes = new Map([[lower.id, lower], [upper.id, upper]]);
      const adjacency = new Map([[lower.id, []], [upper.id, []]]);

      connectVerticalNodesBySuffix(nodes, adjacency, true, false, false);

      expect(adjacency.get(lower.id)).toHaveLength(0);
      expect(adjacency.get(upper.id)).toHaveLength(0);
    });

    test("skips escalator nodes when noEscalators is true", () => {
      const lower = createNode({ id: "A_F1_escalator_landing_1", type: "escalator_landing", floor: 1 });
      const upper = createNode({ id: "A_F2_escalator_landing_1", type: "escalator_landing", floor: 2 });
      const nodes = new Map([[lower.id, lower], [upper.id, upper]]);
      const adjacency = new Map([[lower.id, []], [upper.id, []]]);

      connectVerticalNodesBySuffix(nodes, adjacency, false, true, false);

      expect(adjacency.get(lower.id)).toHaveLength(0);
    });

    test("skips elevator nodes when noElevators is true", () => {
      const lower = createNode({ id: "A_F1_elevator_door_1", type: "elevator_door", floor: 1 });
      const upper = createNode({ id: "A_F2_elevator_door_1", type: "elevator_door", floor: 2 });
      const nodes = new Map([[lower.id, lower], [upper.id, upper]]);
      const adjacency = new Map([[lower.id, []], [upper.id, []]]);

      connectVerticalNodesBySuffix(nodes, adjacency, false, false, true);

      expect(adjacency.get(lower.id)).toHaveLength(0);
    });

    test("skips directional escalator nodes (handled by explicit edges)", () => {
      const lower = createNode({ id: "A_F1_escalator_landing_1", type: "escalator_landing", floor: 1, direction: "up" });
      const upper = createNode({ id: "A_F2_escalator_landing_1", type: "escalator_landing", floor: 2, direction: "up" });
      const nodes = new Map([[lower.id, lower], [upper.id, upper]]);
      const adjacency = new Map([[lower.id, []], [upper.id, []]]);

      connectVerticalNodesBySuffix(nodes, adjacency, false, false, false);

      expect(adjacency.get(lower.id)).toHaveLength(0);
    });

    test("does not connect nodes with different suffixes", () => {
      const a = createNode({ id: "A_F1_stair_landing_1", type: "stair_landing", floor: 1 });
      const b = createNode({ id: "A_F2_stair_landing_2", type: "stair_landing", floor: 2 });
      const nodes = new Map([[a.id, a], [b.id, b]]);
      const adjacency = new Map([[a.id, []], [b.id, []]]);

      connectVerticalNodesBySuffix(nodes, adjacency, false, false, false);

      expect(adjacency.get(a.id)).toHaveLength(0);
      expect(adjacency.get(b.id)).toHaveLength(0);
    });

    test("connects only adjacent floors in a three-floor stairwell", () => {
      const f1 = createNode({ id: "A_F1_stair_landing_1", type: "stair_landing", floor: 1 });
      const f2 = createNode({ id: "A_F2_stair_landing_1", type: "stair_landing", floor: 2 });
      const f3 = createNode({ id: "A_F3_stair_landing_1", type: "stair_landing", floor: 3 });
      const nodes = new Map([[f1.id, f1], [f2.id, f2], [f3.id, f3]]);
      const adjacency = new Map([[f1.id, []], [f2.id, []], [f3.id, []]]);

      connectVerticalNodesBySuffix(nodes, adjacency, false, false, false);

      // f1 connects to f2 only
      expect(adjacency.get(f1.id)).toContainEqual({ neighbor: f2.id, weight: 500 });
      expect(adjacency.get(f1.id)).not.toContainEqual(expect.objectContaining({ neighbor: f3.id }));

      // f2 connects to both f1 and f3
      expect(adjacency.get(f2.id)).toContainEqual({ neighbor: f1.id, weight: 500 });
      expect(adjacency.get(f2.id)).toContainEqual({ neighbor: f3.id, weight: 500 });
    });
  });
});
