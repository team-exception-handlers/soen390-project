import cc1 from "../constants/maps/indoor/cc1.json";
import hallCombined from "../constants/maps/indoor/hall.json";
import hall1 from "../constants/maps/indoor/hall1.json";
import hall2 from "../constants/maps/indoor/hall2.json";
import mbFloorsCombined from "../constants/maps/indoor/mb_floors_combined.json";
import ve1 from "../constants/maps/indoor/ve1.json";
import ve2 from "../constants/maps/indoor/ve2.json";
import vl1 from "../constants/maps/indoor/vl1.json";
import vl2 from "../constants/maps/indoor/vl2.json";

export interface IndoorNode {
  id: string;
  type: string;
  buildingId: string;
  floor: number;
  x: number;
  y: number;
  label?: string;
  accessible: boolean;
}

export interface IndoorEdge {
  source: string;
  target: string;
  type: string;
  weight: number;
  accessible: boolean;
}

export interface IndoorPathSegment {
  floor: number;
  points: { x: number; y: number }[];
}

/** Snap near-horizontal/near-vertical segments to right angles for cleaner display. */
function orthogonalizeSegmentPoints(
  points: { x: number; y: number }[],
): { x: number; y: number }[] {
  if (points.length < 2) return points;
  const result: { x: number; y: number }[] = [points[0]];

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;

    const angleDeg = (Math.atan2(dy, dx) * (180 / Math.PI) + 360) % 360;
    const distToHorizontal = Math.min(
      angleDeg,
      360 - angleDeg,
      Math.abs(angleDeg - 180),
    );
    const distToVertical = Math.min(
      Math.abs(angleDeg - 90),
      Math.abs(angleDeg - 270),
    );

    if (distToHorizontal <= 25) {
      result.push({ x: p1.x, y: p0.y });
    } else if (distToVertical <= 25) {
      result.push({ x: p0.x, y: p1.y });
    }
    result.push({ x: p1.x, y: p1.y });
  }
  return result;
}

export interface IndoorRouteStep {
  instruction: string;
  floor: number;
}

export interface IndoorRoute {
  segments: IndoorPathSegment[];
  steps: IndoorRouteStep[];
  totalDistance: number;
  startFloor: number;
  endFloor: number;
}

type FloorData = { nodes: unknown[]; edges: unknown[] };

const ALL_FLOOR_DATA: FloorData[] = [
  cc1 as FloorData,
  hall1 as unknown as FloorData,
  hall2 as unknown as FloorData,
  hallCombined as unknown as FloorData,
  mbFloorsCombined as FloorData,
  ve1 as FloorData,
  ve2 as FloorData,
  vl1 as FloorData,
  vl2 as FloorData,
];

/** App building code "H" (Henry F. Hall) maps to JSON buildingId "Hall". MB includes S2 (MB-S2). */
function buildingIdMatches(
  buildingCode: string,
  nodeBuildingId: string,
): boolean {
  return (
    nodeBuildingId === buildingCode ||
    (buildingCode === "H" && nodeBuildingId === "Hall") ||
    (buildingCode === "MB" && nodeBuildingId === "MB-S2")
  );
}

/** JSON may use prefixed labels (e.g. "H-822", "VL-202-30"); app often sends "822", "202-30". Match both. */
function roomLabelMatches(
  buildingCode: string,
  nodeLabel: string | undefined,
  userLabel: string,
): boolean {
  if (!nodeLabel) return false;
  if (nodeLabel === userLabel) return true;
  const prefix = buildingCode === "H" ? "H" : buildingCode;
  if (nodeLabel === `${prefix}-${userLabel}`) return true;
  return false;
}

const VERTICAL_NODE_TYPES = new Set(["stair_landing", "elevator_door"]);
const INTER_FLOOR_WEIGHT = 500;

/** Graph edge weights are in same scale as floor plan units; convert to meters for display. */
const UNITS_PER_METER = 20;

function getFloorQuery(
  buildingCode: string,
  floor: number,
): {
  targetFloor: number;
  matchesNode: (node: IndoorNode) => boolean;
} {
  if (buildingCode === "MB" && floor === -2) {
    return {
      targetFloor: 1,
      matchesNode: (node) => node.buildingId === "MB-S2" && node.floor === 1,
    };
  }

  return {
    targetFloor: floor,
    matchesNode: (node) =>
      buildingIdMatches(buildingCode, node.buildingId) && node.floor === floor,
  };
}

function filterFloorData(
  floorData: FloorData,
  predicate: (node: IndoorNode) => boolean,
): FloorData {
  const allowedNodeIds = new Set(
    (floorData.nodes as IndoorNode[]).filter(predicate).map((node) => node.id),
  );

  return {
    nodes: (floorData.nodes as IndoorNode[]).filter((node) =>
      allowedNodeIds.has(node.id),
    ),
    edges: (floorData.edges as IndoorEdge[]).filter(
      (edge) =>
        allowedNodeIds.has(edge.source) && allowedNodeIds.has(edge.target),
    ),
  };
}

function getBuildingFloors(buildingCode: string): FloorData[] {
  const matchedFloors = ALL_FLOOR_DATA.filter((f) => {
    const firstNode = f.nodes[0] as IndoorNode | undefined;
    return (
      firstNode != null && buildingIdMatches(buildingCode, firstNode.buildingId)
    );
  });

  if (buildingCode !== "H") {
    return matchedFloors;
  }

  return matchedFloors.flatMap((floorData) => {
    if (floorData !== (hallCombined as unknown as FloorData)) {
      return [floorData];
    }

    const filteredHallCombined = filterFloorData(
      floorData,
      (node) => node.floor !== 1 && node.floor !== 2,
    );

    return filteredHallCombined.nodes.length > 0 ? [filteredHallCombined] : [];
  });
}

function buildGraph(floors: FloorData[]): {
  nodes: Map<string, IndoorNode>;
  adjacency: Map<string, { neighbor: string; weight: number }[]>;
} {
  const nodes = new Map<string, IndoorNode>();
  const adjacency = new Map<string, { neighbor: string; weight: number }[]>();

  for (const floor of floors) {
    for (const n of floor.nodes as IndoorNode[]) {
      nodes.set(n.id, n);
      if (!adjacency.has(n.id)) adjacency.set(n.id, []);
    }
    for (const e of floor.edges as IndoorEdge[]) {
      if (!adjacency.has(e.source)) adjacency.set(e.source, []);
      if (!adjacency.has(e.target)) adjacency.set(e.target, []);
      adjacency.get(e.source)!.push({ neighbor: e.target, weight: e.weight });
      adjacency.get(e.target)!.push({ neighbor: e.source, weight: e.weight });
    }
  }

  // Connect stair/elevator nodes with the same suffix across floors (same physical location)
  const bySuffix = new Map<string, IndoorNode[]>();
  nodes.forEach((node) => {
    if (VERTICAL_NODE_TYPES.has(node.type)) {
      const match = node.id.match(/_(stair_landing|elevator_door)_(\d+)$/);
      if (match) {
        const key = `${match[1]}_${match[2]}`;
        const list = bySuffix.get(key) ?? [];
        list.push(node);
        bySuffix.set(key, list);
      }
    }
  });

  bySuffix.forEach((connectedNodes) => {
    if (connectedNodes.length < 2) return;
    connectedNodes.sort((a, b) => a.floor - b.floor);
    for (let i = 0; i < connectedNodes.length - 1; i++) {
      const a = connectedNodes[i];
      const b = connectedNodes[i + 1];
      adjacency.get(a.id)!.push({ neighbor: b.id, weight: INTER_FLOOR_WEIGHT });
      adjacency.get(b.id)!.push({ neighbor: a.id, weight: INTER_FLOOR_WEIGHT });
    }
  });

  return { nodes, adjacency };
}

/** Binary min-heap keyed by cost — O(log n) push/pop vs O(n log n) array.sort. */
class MinHeap {
  private heap: { id: string; cost: number }[] = [];

  get size() {
    return this.heap.length;
  }

  push(id: string, cost: number) {
    this.heap.push({ id, cost });
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): { id: string; cost: number } | undefined {
    if (this.heap.length === 0) return undefined;
    const min = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.sinkDown(0);
    }
    return min;
  }

  private bubbleUp(i: number) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.heap[parent].cost <= this.heap[i].cost) break;
      [this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]];
      i = parent;
    }
  }

  private sinkDown(i: number) {
    const n = this.heap.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      if (l < n && this.heap[l].cost < this.heap[smallest].cost) smallest = l;
      if (r < n && this.heap[r].cost < this.heap[smallest].cost) smallest = r;
      if (smallest === i) break;
      [this.heap[smallest], this.heap[i]] = [this.heap[i], this.heap[smallest]];
      i = smallest;
    }
  }
}

/**
 * When set, pathfinding only follows edges that stay on this floor (no stairs/elevators
 * to other floors). Use when start and end are on the same floor.
 * When excludeVerticalTransit is true (same-floor), avoids elevator/stair nodes; if
 * no path exists without them, call again with false to allow a path through them.
 */
function dijkstra(
  nodes: Map<string, IndoorNode>,
  adjacency: Map<string, { neighbor: string; weight: number }[]>,
  startId: string,
  endId: string,
  restrictToFloor: number | null = null,
  restrictToBuildingId: string | null = null,
  excludeVerticalTransit: boolean = false,
): { path: string[]; distance: number } | null {
  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const visited = new Set<string>();
  const heap = new MinHeap();

  nodes.forEach((_, id) => {
    dist.set(id, Infinity);
    prev.set(id, null);
  });

  dist.set(startId, 0);
  heap.push(startId, 0);

  while (heap.size > 0) {
    const { id: current } = heap.pop()!;

    if (visited.has(current)) continue;
    visited.add(current);

    if (current === endId) break;

    for (const { neighbor, weight } of adjacency.get(current) ?? []) {
      if (visited.has(neighbor)) continue;
      if (restrictToFloor != null || restrictToBuildingId != null) {
        const neighborNode = nodes.get(neighbor);
        if (neighborNode == null) continue;
        if (restrictToFloor != null) {
          const allowedFloors =
            restrictToFloor === -2 ? [1, -2] : [restrictToFloor];
          if (!allowedFloors.includes(neighborNode.floor)) continue;
        }
        if (
          excludeVerticalTransit &&
          VERTICAL_NODE_TYPES.has(neighborNode.type)
        )
          continue;
        if (
          restrictToBuildingId != null &&
          neighborNode.buildingId !== restrictToBuildingId
        )
          continue;
      }
      const newDist = (dist.get(current) ?? 0) + weight;
      if (newDist < (dist.get(neighbor) ?? Infinity)) {
        dist.set(neighbor, newDist);
        prev.set(neighbor, current);
        heap.push(neighbor, newDist);
      }
    }
  }

  if ((dist.get(endId) ?? Infinity) === Infinity) return null;

  const path: string[] = [];
  let current: string | null | undefined = endId;
  while (current != null) {
    path.unshift(current);
    current = prev.get(current) ?? null;
  }

  return { path, distance: dist.get(endId) ?? 0 };
}

const HALLWAY_NODE_TYPES = new Set([
  "hallway",
  "hallway_waypoint",
  "door_to_hallway",
  "doorway",
]);

function formatFloorLabel(node: IndoorNode): string {
  if (node.buildingId === "MB" && node.floor === -2) {
    return "S2";
  }
  return String(node.floor);
}

// Returns the turn direction from two direction vectors (in/out at a vertex).
function turnFromVectors(
  inDx: number,
  inDy: number,
  outDx: number,
  outDy: number,
): "left" | "right" | "straight" {
  const cross = inDx * outDy - inDy * outDx;
  const lenA = Math.hypot(inDx, inDy) || 1;
  const lenB = Math.hypot(outDx, outDy) || 1;
  const sinAngle = cross / (lenA * lenB);
  if (sinAngle > 0.25) return "right";
  if (sinAngle < -0.25) return "left";
  return "straight";
}

// Returns the turn direction using the same orthogonalized geometry as the displayed route,
// so step-by-step instructions match what the user sees on the map.
function getTurnDirection(
  prev: IndoorNode,
  curr: IndoorNode,
  next: IndoorNode,
): "left" | "right" | "straight" {
  const triple = [
    { x: prev.x, y: prev.y },
    { x: curr.x, y: curr.y },
    { x: next.x, y: next.y },
  ];
  const ortho = orthogonalizeSegmentPoints(triple);
  if (ortho.length < 3) {
    const ax = curr.x - prev.x;
    const ay = curr.y - prev.y;
    const bx = next.x - curr.x;
    const by = next.y - curr.y;
    return turnFromVectors(ax, ay, bx, by);
  }
  let midIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < ortho.length; i++) {
    const d =
      (ortho[i].x - curr.x) * (ortho[i].x - curr.x) +
      (ortho[i].y - curr.y) * (ortho[i].y - curr.y);
    if (d < bestDist) {
      bestDist = d;
      midIdx = i;
    }
  }
  if (midIdx <= 0 || midIdx >= ortho.length - 1) {
    const ax = curr.x - prev.x;
    const ay = curr.y - prev.y;
    const bx = next.x - curr.x;
    const by = next.y - curr.y;
    return turnFromVectors(ax, ay, bx, by);
  }
  const inDx = ortho[midIdx].x - ortho[midIdx - 1].x;
  const inDy = ortho[midIdx].y - ortho[midIdx - 1].y;
  const outDx = ortho[midIdx + 1].x - ortho[midIdx].x;
  const outDy = ortho[midIdx + 1].y - ortho[midIdx].y;
  return turnFromVectors(inDx, inDy, outDx, outDy);
}

/** Find the nearest room label to a node (for landmark text). */
function getNearestRoomLabel(
  curr: IndoorNode,
  allFloorNodes: IndoorNode[],
  excludeIds: Set<string>,
  maxDistance: number,
  restrictToBuildingId: string | null = null,
): string | null {
  let best: { label: string; dist: number } | null = null;
  for (const n of allFloorNodes) {
    if (
      n.type !== "room" ||
      n.id === curr.id ||
      excludeIds.has(n.id) ||
      !n.label ||
      n.floor !== curr.floor
    )
      continue;
    if (restrictToBuildingId != null && n.buildingId !== restrictToBuildingId)
      continue;
    // Same-floor routes on MB (floor 1) should only reference MB rooms, not MB-S2.
    if (
      restrictToBuildingId == null &&
      curr.buildingId === "MB" &&
      n.buildingId === "MB-S2"
    )
      continue;
    // S2 routes should only reference MB-S2 rooms, not MB (1st floor).
    if (
      restrictToBuildingId == null &&
      curr.buildingId === "MB-S2" &&
      n.buildingId === "MB"
    )
      continue;
    const dx = n.x - curr.x;
    const dy = n.y - curr.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= maxDistance && (!best || dist < best.dist))
      best = { label: n.label, dist };
  }
  return best?.label ?? null;
}

function getEdgeWeight(
  adjacency: Map<string, { neighbor: string; weight: number }[]>,
  fromId: string,
  toId: string,
): number {
  const list = adjacency.get(fromId);
  if (!list) return 0;
  const edge = list.find((e) => e.neighbor === toId);
  return edge?.weight ?? 0;
}

function roundDistanceHuman(units: number): string {
  const m = units / UNITS_PER_METER;
  if (m < 2) return `${Math.round(m * 2) / 2}`;
  if (m < 20) return `${Math.round(m)}`;
  return `${Math.round(m / 5) * 5}`;
}

/**
 * Determine which side of the corridor the destination room is on.
 * Uses the dominant axis of the approach vector (y-down SVG coordinates).
 */
function getArrivalSide(prev: IndoorNode, dest: IndoorNode): "left" | "right" {
  const dx = dest.x - prev.x;
  const dy = dest.y - prev.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    // Mostly horizontal: left = toward top of screen (smaller y) when walking east
    return dx > 0
      ? dest.y <= prev.y
        ? "left"
        : "right"
      : dest.y <= prev.y
        ? "right"
        : "left";
  } else {
    // Mostly vertical: left = larger x (east) when walking south (dy > 0 in y-down)
    return dy > 0
      ? dest.x >= prev.x
        ? "left"
        : "right"
      : dest.x >= prev.x
        ? "right"
        : "left";
  }
}

// Simplify the raw Dijkstra path into waypoints for step generation.
function simplifyPathForSteps(
  pathNodes: IndoorNode[],
  distFromStart: number[],
): { nodes: IndoorNode[]; distances: number[] } {
  if (pathNodes.length <= 2) {
    return {
      nodes: pathNodes,
      distances: distFromStart.slice(0, pathNodes.length),
    };
  }

  const TURN_THRESHOLD_RAD = 18 * (Math.PI / 180);

  const mustKeep = (n: IndoorNode) =>
    n.type === "room" || VERTICAL_NODE_TYPES.has(n.type);

  const keepIndices = new Set<number>([0, pathNodes.length - 1]);
  for (let i = 0; i < pathNodes.length; i++) {
    if (mustKeep(pathNodes[i])) keepIndices.add(i);
  }

  let lastKeptIdx = 0;
  for (let i = 1; i < pathNodes.length - 1; i++) {
    const curr = pathNodes[i];
    const next = pathNodes[i + 1];
    const lastKept = pathNodes[lastKeptIdx];

    if (keepIndices.has(i)) {
      lastKeptIdx = i;
      continue;
    }

    if (curr.floor !== lastKept.floor) {
      keepIndices.add(i);
      lastKeptIdx = i;
      continue;
    }

    if (!HALLWAY_NODE_TYPES.has(curr.type)) continue;
    if (next.floor !== curr.floor) continue;

    const ax = curr.x - lastKept.x;
    const ay = curr.y - lastKept.y;
    const bx = next.x - curr.x;
    const by = next.y - curr.y;
    const lenA = Math.hypot(ax, ay);
    const lenB = Math.hypot(bx, by);
    if (lenA < 1e-6 || lenB < 1e-6) continue;

    const sinAngle = (ax * by - ay * bx) / (lenA * lenB);
    const cosAngle = (ax * bx + ay * by) / (lenA * lenB);
    const angle = Math.abs(Math.atan2(Math.abs(sinAngle), cosAngle));

    if (angle > TURN_THRESHOLD_RAD) {
      keepIndices.add(i);
      lastKeptIdx = i;
    }
  }

  const sorted = [...keepIndices].sort((a, b) => a - b);
  return {
    nodes: sorted.map((i) => pathNodes[i]),
    distances: sorted.map((i) => distFromStart[i]),
  };
}

/**
 * Convert a simplified indoor path into Google Maps-style step-by-step directions.
 */
function buildSteps(
  allPathNodes: IndoorNode[],
  allDistFromStart: number[],
  _adjacency: Map<string, { neighbor: string; weight: number }[]>,
  allFloorNodes: IndoorNode[],
  landmarkBuildingId: string | null = null,
): IndoorRouteStep[] {
  if (allPathNodes.length === 0) return [];

  const { nodes, distances } = simplifyPathForSteps(
    allPathNodes,
    allDistFromStart,
  );

  // IDs of start and destination — excluded from landmark references.
  const endpointIds = new Set<string>();
  if (allPathNodes.length > 0) endpointIds.add(allPathNodes[0].id);
  if (allPathNodes.length > 1)
    endpointIds.add(allPathNodes[allPathNodes.length - 1].id);

  const steps: IndoorRouteStep[] = [];
  const start = nodes[0];
  steps.push({
    instruction: `Start at room ${start.label ?? start.id}.`,
    floor: start.floor,
  });

  if (nodes.length === 1) return steps;

  // Minimum walk (units) worth emitting as a standalone "Walk about X m." step.
  const MIN_WALK_EMIT = 80; // ~0.8 m
  // Minimum walk (units) worth a "Continue straight for about X m." step.
  const MIN_STRAIGHT_EMIT = 80; // ~0.8 m
  // Minimum walk (units) worth appending as "and continue for about Y m" after a turn.
  const MIN_CONTINUE = 80; // ~0.8 m

  let currentFloor = start.floor;
  let inPassThroughFloor = false;
  let lastEmittedDistIdx = 0;
  let lastLandmarkUsed: string | null = null;
  let lastStraightDistUnits = 0; // for merging consecutive "Continue straight" steps

  // A floor is pass-through if the route exits it before reaching any room.
  const isPassThroughFloor = (fromIdx: number, floor: number): boolean => {
    for (let j = fromIdx; j < nodes.length; j++) {
      if (nodes[j].floor !== floor) return true;
      if (nodes[j].type === "room" && nodes[j].id !== start.id) return false;
    }
    return false;
  };

  for (let i = 1; i < nodes.length; i++) {
    const node = nodes[i];
    const prev = nodes[i - 1];
    const next = nodes[i + 1];
    // Distance from where we last accounted for distance to this node.
    const segDist = distances[i] - distances[lastEmittedDistIdx];

    // Floor change
    if (node.floor !== currentFloor) {
      if (isPassThroughFloor(i, node.floor)) {
        currentFloor = node.floor;
        inPassThroughFloor = true;
        continue;
      }
      inPassThroughFloor = false;
      const via =
        prev.type === "elevator_door" || node.type === "elevator_door"
          ? "elevator"
          : "stairs";
      const walkPart =
        segDist >= MIN_WALK_EMIT
          ? `Walk about ${roundDistanceHuman(segDist)} m, then `
          : "";
      steps.push({
        instruction: `${walkPart}take the ${via} to floor ${formatFloorLabel(node)}.`,
        floor: node.floor,
      });
      currentFloor = node.floor;
      lastEmittedDistIdx = i;
      lastStraightDistUnits = 0;
      continue;
    }

    if (inPassThroughFloor) continue;

    // Destination room
    if (node.type === "room" && node.id !== start.id) {
      if (segDist >= MIN_WALK_EMIT) {
        steps.push({
          instruction: `Continue straight ahead for about ${roundDistanceHuman(segDist)} m.`,
          floor: node.floor,
        });
      }
      const side = getArrivalSide(prev, node);
      steps.push({
        instruction: `Room ${node.label ?? "destination"} will be on your ${side}.`,
        floor: node.floor,
      });
      lastEmittedDistIdx = i;
      lastStraightDistUnits = 0;
      continue;
    }

    // Hallway waypoint (turn or straight)
    if (!next || !HALLWAY_NODE_TYPES.has(node.type)) continue;

    const turn = getTurnDirection(prev, node, next);
    if (turn === "straight") {
      if (segDist >= MIN_STRAIGHT_EMIT) {
        const lastStep = steps[steps.length - 1];
        const lastIsStraight = lastStep?.instruction.startsWith(
          "Continue straight ahead for about ",
        );
        if (lastIsStraight) {
          steps.pop();
          const mergedUnits = lastStraightDistUnits + segDist;
          steps.push({
            instruction: `Continue straight ahead for about ${roundDistanceHuman(mergedUnits)} m.`,
            floor: node.floor,
          });
          lastStraightDistUnits = mergedUnits;
        } else {
          steps.push({
            instruction: `Continue straight ahead for about ${roundDistanceHuman(segDist)} m.`,
            floor: node.floor,
          });
          lastStraightDistUnits = segDist;
        }
        lastEmittedDistIdx = i;
      }
      continue;
    }

    // Emit the walk leading up to this turn (same direction as previous step).
    if (segDist >= MIN_WALK_EMIT) {
      const lastStep = steps[steps.length - 1];
      const lastIsStraight = lastStep?.instruction.startsWith(
        "Continue straight ahead for about ",
      );
      if (lastIsStraight) {
        steps.pop();
        const mergedUnits = lastStraightDistUnits + segDist;
        steps.push({
          instruction: `Continue straight ahead for about ${roundDistanceHuman(mergedUnits)} m.`,
          floor: node.floor,
        });
        lastStraightDistUnits = mergedUnits;
      } else {
        steps.push({
          instruction: `Continue straight ahead for about ${roundDistanceHuman(segDist)} m.`,
          floor: node.floor,
        });
        lastStraightDistUnits = segDist;
      }
    }
    lastEmittedDistIdx = i;
    lastStraightDistUnits = 0; // turn ends any straight run

    // "and continue for about Y m" — distance from this turn to the next waypoint,
    // only when both nodes are on the same floor (stairs/elevator handled separately).
    const nextSegDist =
      distances[Math.min(i + 1, nodes.length - 1)] - distances[i];
    const sameFloorNext = nodes[i + 1]?.floor === node.floor;
    const continueStr =
      nextSegDist >= MIN_CONTINUE && sameFloorNext
        ? ` and continue for about ${roundDistanceHuman(nextSegDist)} m`
        : "";
    // Advance so node i+1 does not re-emit the distance just mentioned.
    if (continueStr) lastEmittedDistIdx = i + 1;

    const nextIsDestination =
      i + 1 === nodes.length - 1 && nodes[i + 1]?.type === "room";
    const LANDMARK_RADIUS_UNITS = 80; // ~2.5 m at 30 units/m — only mention rooms right at the turn
    const rawLandmark = nextIsDestination
      ? null
      : getNearestRoomLabel(
          node,
          allFloorNodes,
          endpointIds,
          LANDMARK_RADIUS_UNITS,
          landmarkBuildingId,
        );
    const landmark = rawLandmark !== lastLandmarkUsed ? rawLandmark : null;
    const atPhrase = landmark ? ` at room ${landmark}` : "";
    lastLandmarkUsed = rawLandmark ?? lastLandmarkUsed;

    const turnInstruction = `Turn ${turn}${atPhrase}${continueStr}.`;
    const lastStep = steps[steps.length - 1];
    if (lastStep?.instruction === turnInstruction) continue; // skip duplicate turn

    steps.push({
      instruction: turnInstruction,
      floor: node.floor,
    });
  }

  return steps;
}

export function findIndoorRoute(
  buildingCode: string,
  startRoomLabel: string,
  endRoomLabel: string,
): IndoorRoute | null {
  const floors = getBuildingFloors(buildingCode);
  if (floors.length === 0) return null;

  const { nodes, adjacency } = buildGraph(floors);
  let startNode: IndoorNode | undefined;
  let endNode: IndoorNode | undefined;

  nodes.forEach((node) => {
    if (
      node.type === "room" &&
      buildingIdMatches(buildingCode, node.buildingId)
    ) {
      if (roomLabelMatches(buildingCode, node.label, startRoomLabel))
        startNode = node;
      if (roomLabelMatches(buildingCode, node.label, endRoomLabel))
        endNode = node;
    }
  });

  if (!startNode || !endNode) return null;

  if (startNode.id === endNode.id) {
    return {
      segments: [
        {
          floor: startNode.floor,
          points: [{ x: startNode.x, y: startNode.y }],
        },
      ],
      steps: [
        {
          instruction: `You are already at room ${startRoomLabel}`,
          floor: startNode.floor,
        },
      ],
      totalDistance: 0,
      startFloor: startNode.floor,
      endFloor: endNode.floor,
    };
  }

  const sameFloor = startNode.floor === endNode.floor;
  // When same floor, restrict to that floor only (no stairs/elevators). Do not restrict
  // by buildingId so we can traverse shared connectors (e.g. doorways to MB room 1.210).
  let result = dijkstra(
    nodes,
    adjacency,
    startNode.id,
    endNode.id,
    sameFloor ? startNode.floor : null,
    null,
    true, // prefer route that avoids elevator/stairs
  );
  if (sameFloor && !result) {
    result = dijkstra(
      nodes,
      adjacency,
      startNode.id,
      endNode.id,
      startNode.floor,
      null,
      false, // fallback: allow path through elevator/stair if no alternative
    );
  }
  const graphNodes = nodes;
  const graphAdjacency = adjacency;
  if (!result) return null;

  const pathNodes = result.path
    .map((id) => graphNodes.get(id))
    .filter((n): n is IndoorNode => n !== undefined);

  const distFromStart: number[] = [0];
  for (let i = 1; i < pathNodes.length; i++) {
    const w = getEdgeWeight(
      graphAdjacency,
      pathNodes[i - 1].id,
      pathNodes[i].id,
    );
    distFromStart[i] = distFromStart[i - 1] + w;
  }

  const segments: IndoorPathSegment[] = [];
  let currentSegment: IndoorPathSegment | null = null;

  for (const node of pathNodes) {
    if (!currentSegment || currentSegment.floor !== node.floor) {
      if (currentSegment) segments.push(currentSegment);
      currentSegment = { floor: node.floor, points: [] };
    }
    currentSegment.points.push({ x: node.x, y: node.y });
  }
  if (currentSegment) segments.push(currentSegment);

  const orthogonalSegments = segments.map((seg) => ({
    floor: seg.floor,
    points: orthogonalizeSegmentPoints(seg.points),
  }));

  const allFloorNodes = Array.from(graphNodes.values());

  const landmarkBuildingId =
    startNode.buildingId === "MB-S2" && endNode.buildingId === "MB-S2"
      ? "MB-S2"
      : null;

  return {
    segments: orthogonalSegments,
    steps: buildSteps(
      pathNodes,
      distFromStart,
      graphAdjacency,
      allFloorNodes,
      landmarkBuildingId,
    ),
    totalDistance: result.distance,
    startFloor: startNode.floor,
    endFloor: endNode.floor,
  };
}

/**
 * Bounds (width, height) of floor plan images. When you map JSON coordinates to a PNG,
 * use that PNG's pixel dimensions here so the overlay aligns with the image.
 * Key: `${buildingCode}-${floor}` (e.g. "MB-1", "MB--2" for S2).
 */
const FLOOR_PLAN_IMAGE_BOUNDS: Record<
  string,
  { width: number; height: number }
> = {
  "MB-1": { width: 1024, height: 1024 },
  "MB--2": { width: 1024, height: 1024 },
  "H-1": { width: 1024, height: 1024 },
  "H-2": { width: 1024, height: 1024 },
  "H-8": { width: 1024, height: 1024 },
  "H-9": { width: 1024, height: 1024 },
  "VE-1": { width: 1024, height: 1024 },
  "VE-2": { width: 1385, height: 650 },
  "VL-1": { width: 1024, height: 1024 },
  "VL-2": { width: 1024, height: 1024 },
};

export function getFloorBounds(
  buildingCode: string,
  floor: number,
): { width: number; height: number } {
  const imageKey = `${buildingCode}-${floor}`;
  const imageBounds = FLOOR_PLAN_IMAGE_BOUNDS[imageKey];
  if (imageBounds) {
    return imageBounds;
  }

  let floorData: FloorData | undefined;

  if (buildingCode === "H" && floor === 1) {
    floorData = hall1 as unknown as FloorData;
  } else if (buildingCode === "H" && floor === 2) {
    floorData = hall2 as unknown as FloorData;
  } else {
    floorData = ALL_FLOOR_DATA.find((f) => {
      const nodes = f.nodes as IndoorNode[];
      const { matchesNode } = getFloorQuery(buildingCode, floor);
      return nodes.some(matchesNode);
    });
  }

  if (!floorData) return { width: 2000, height: 1500 };

  let maxX = 0;
  let maxY = 0;
  const { matchesNode } = getFloorQuery(buildingCode, floor);

  for (const n of floorData.nodes as IndoorNode[]) {
    if (!matchesNode(n)) continue;
    if (n.x > maxX) maxX = n.x;
    if (n.y > maxY) maxY = n.y;
  }

  return { width: maxX + 200, height: maxY + 200 };
}

export function getGraphFloorBounds(
  buildingCode: string,
  floor: number,
): { width: number; height: number } {
  let floorData: FloorData | undefined;

  if (buildingCode === "H" && floor === 1) {
    floorData = hall1 as unknown as FloorData;
  } else if (buildingCode === "H" && floor === 2) {
    floorData = hall2 as unknown as FloorData;
  } else {
    floorData = ALL_FLOOR_DATA.find((f) => {
      const nodes = f.nodes as IndoorNode[];
      const { matchesNode } = getFloorQuery(buildingCode, floor);
      return nodes.some(matchesNode);
    });
  }

  if (!floorData) return { width: 2000, height: 1500 };

  let maxX = 0;
  let maxY = 0;
  const { matchesNode } = getFloorQuery(buildingCode, floor);

  for (const n of floorData.nodes as IndoorNode[]) {
    if (!matchesNode(n)) continue;
    if (n.x > maxX) maxX = n.x;
    if (n.y > maxY) maxY = n.y;
  }

  const key = `${buildingCode}-${floor}`;
  switch (key) {
    case "VL-1":
      return { width: maxX + 100, height: maxY + 100 };
    case "VL-2":
      return { width: maxX + 200, height: maxY + 200 };
    case "VE-1":
      return { width: maxX + 200, height: maxY + 100 };
    case "VE-2":
      return { width: maxX + 150, height: maxY + 100 };
    case "CC-1":
      return { width: maxX + 550, height: maxY + 170 };
    case "H-1":
      return { width: maxX + 20, height: maxY + 40 };
    case "H-2":
      return { width: maxX + 20, height: maxY + 255 };
    case "MB-1":
      return { width: maxX + 60, height: maxY + 50 };
    case "MB--2":
      return { width: maxX + 80, height: maxY + 50 };
    default:
      return { width: maxX + 20, height: maxY + 255 };
  }
}
