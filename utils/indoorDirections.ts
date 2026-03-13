import CC1 from "../constants/maps/indoor/CC1.json";
import HALL1 from "../constants/maps/indoor/HALL-1.json";
import HALL2 from "../constants/maps/indoor/HALL-2.json";
import HALL8 from "../constants/maps/indoor/HALL-8.json";
import HALL9 from "../constants/maps/indoor/HALL-9.json";
import MB1 from "../constants/maps/indoor/MB-1.json";
import MBS2 from "../constants/maps/indoor/MB-S2.json";
import VE1 from "../constants/maps/indoor/VE-1.json";
import VE2 from "../constants/maps/indoor/VE-2.json";
import VL1 from "../constants/maps/indoor/VL-1.json";
import VL2 from "../constants/maps/indoor/VL-2.json";

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
  CC1 as FloorData,
  HALL1 as FloorData,
  HALL2 as FloorData,
  HALL8 as FloorData,
  HALL9 as FloorData,
  MB1 as FloorData,
  MBS2 as FloorData,
  VE1 as FloorData,
  VE2 as FloorData,
  VL1 as FloorData,
  VL2 as FloorData,
];

const VERTICAL_NODE_TYPES = new Set(["stair_landing", "elevator_door"]);
const INTER_FLOOR_WEIGHT = 500;

/** Graph edge weights are in same scale as floor plan units; convert to meters for display. */
const UNITS_PER_METER = 100;

function getBuildingFloors(buildingCode: string): FloorData[] {
  return ALL_FLOOR_DATA.filter((f) => {
    const firstNode = f.nodes[0] as IndoorNode | undefined;
    return firstNode?.buildingId === buildingCode;
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

function dijkstra(
  nodes: Map<string, IndoorNode>,
  adjacency: Map<string, { neighbor: string; weight: number }[]>,
  startId: string,
  endId: string,
): { path: string[]; distance: number } | null {
  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const visited = new Set<string>();
  const queue: { id: string; cost: number }[] = [];

  nodes.forEach((_, id) => {
    dist.set(id, Infinity);
    prev.set(id, null);
  });

  dist.set(startId, 0);
  queue.push({ id: startId, cost: 0 });

  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const { id: current } = queue.shift()!;

    if (visited.has(current)) continue;
    visited.add(current);

    if (current === endId) break;

    for (const { neighbor, weight } of adjacency.get(current) ?? []) {
      if (visited.has(neighbor)) continue;
      const newDist = (dist.get(current) ?? 0) + weight;
      if (newDist < (dist.get(neighbor) ?? Infinity)) {
        dist.set(neighbor, newDist);
        prev.set(neighbor, current);
        queue.push({ id: neighbor, cost: newDist });
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

/** Turn direction from walking prev -> curr -> next. Uses cross product. */
function getTurnDirection(
  prev: IndoorNode,
  curr: IndoorNode,
  next: IndoorNode,
): "left" | "right" | "straight" {
  const ax = curr.x - prev.x;
  const ay = curr.y - prev.y;
  const bx = next.x - curr.x;
  const by = next.y - curr.y;
  const cross = ax * by - ay * bx;
  const lenA = Math.hypot(ax, ay) || 1;
  const lenB = Math.hypot(bx, by) || 1;
  const sinAngle = cross / (lenA * lenB);
  if (sinAngle > 0.25) return "left";
  if (sinAngle < -0.25) return "right";
  return "straight";
}

/** Find the nearest room label to a node (for landmark text). */
function getNearestRoomLabel(
  curr: IndoorNode,
  pathNodes: IndoorNode[],
  maxDistance: number,
): string | null {
  let best: { label: string; dist: number } | null = null;
  for (const n of pathNodes) {
    if (
      n.type !== "room" ||
      n.id === curr.id ||
      !n.label ||
      n.floor !== curr.floor
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

function formatDistanceMeters(units: number): string {
  const m = units / UNITS_PER_METER;
  return m % 1 === 0 ? `${Math.round(m)}` : m.toFixed(1);
}

function buildSteps(
  pathNodes: IndoorNode[],
  distFromStart: number[],
  adjacency: Map<string, { neighbor: string; weight: number }[]>,
): IndoorRouteStep[] {
  if (pathNodes.length === 0) return [];

  const steps: IndoorRouteStep[] = [];
  const start = pathNodes[0];
  steps.push({
    instruction: `Start at room ${start.label ?? start.id}`,
    floor: start.floor,
  });

  let currentFloor = start.floor;
  let lastStepPathIndex = 0;

  // Floor-change steps are deferred so that consecutive pass-through floors
  // (e.g. floor 1 → floor 8 → floor 2 in Hall) collapse into a single step.
  let pendingFloorChange: {
    instruction: string;
    floor: number;
    pathIndex: number;
  } | null = null;

  const flushPendingFloorChange = () => {
    if (!pendingFloorChange) return;
    steps.push({
      instruction: pendingFloorChange.instruction,
      floor: pendingFloorChange.floor,
    });
    lastStepPathIndex = pendingFloorChange.pathIndex;
    pendingFloorChange = null;
  };

  // Ignore connector-only floors (for example Hall routes that briefly pass
  // through floor 8 while going from floor 1 to floor 2). A floor is
  // pass-through if the route leaves it again before reaching any room node.
  const isPassThroughFloor = (startIndex: number, floor: number): boolean => {
    for (let j = startIndex; j < pathNodes.length; j++) {
      const lookahead = pathNodes[j];
      if (lookahead.floor !== floor) return true;
      if (lookahead.type === "room" && lookahead.id !== start.id) return false;
    }
    return false;
  };

  for (let i = 1; i < pathNodes.length; i++) {
    const node = pathNodes[i];
    const prev = pathNodes[i - 1];
    const next = pathNodes[i + 1];

    if (node.floor !== currentFloor) {
      const via =
        prev.type === "elevator_door" || node.type === "elevator_door"
          ? "elevator"
          : "stairs";
      const distFromLastStep =
        distFromStart[i] - distFromStart[lastStepPathIndex];
      const distStr =
        distFromLastStep > 0
          ? `In ${formatDistanceMeters(distFromLastStep)} m, `
          : "";
      // Overwrite any existing pending step — this collapses pass-through floors
      // (e.g. the Hall building routes through floor 8 to get between floors 1 and 2).
      pendingFloorChange = {
        instruction:
          via === "elevator"
            ? `${distStr}take the elevator to floor ${formatFloorLabel(node)}`
            : `${distStr}take the stairs to floor ${formatFloorLabel(node)}`,
        floor: node.floor,
        pathIndex: i,
      };
      currentFloor = node.floor;
    } else if (node.type === "room" && node.id !== start.id) {
      flushPendingFloorChange();
      const distFromLastStep =
        distFromStart[i] - distFromStart[lastStepPathIndex];
      const distStr =
        distFromLastStep > 0
          ? `In ${formatDistanceMeters(distFromLastStep)} m, `
          : "";
      const side = node.x < prev.x ? "left" : "right";
      steps.push({
        instruction: `${distStr}arrive at room ${node.label ?? "destination"}. It will be on your ${side}.`,
        floor: node.floor,
      });
      lastStepPathIndex = i;
    } else if (
      next &&
      currentFloor === node.floor &&
      HALLWAY_NODE_TYPES.has(node.type)
    ) {
      if (pendingFloorChange && isPassThroughFloor(i, node.floor)) {
        continue;
      }
      const turn = getTurnDirection(prev, node, next);
      if (turn === "left" || turn === "right") {
        flushPendingFloorChange();
        const distFromLastStep =
          distFromStart[i] - distFromStart[lastStepPathIndex];
        const distStr =
          distFromLastStep > 0
            ? `In ${formatDistanceMeters(distFromLastStep)} m, `
            : "";
        const landmark = getNearestRoomLabel(node, pathNodes, 400);
        const atPhrase = landmark ? ` at room ${landmark}` : "";
        steps.push({
          instruction: `${distStr}turn ${turn}${atPhrase}`,
          floor: node.floor,
        });
        lastStepPathIndex = i;
      }
    }
  }

  // Emit any remaining floor-change step (e.g. if the route ends on a new floor).
  flushPendingFloorChange();

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
    if (node.type === "room" && node.buildingId === buildingCode) {
      if (node.label === startRoomLabel) startNode = node;
      if (node.label === endRoomLabel) endNode = node;
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

  const result = dijkstra(nodes, adjacency, startNode.id, endNode.id);
  if (!result) return null;

  const pathNodes = result.path
    .map((id) => nodes.get(id))
    .filter((n): n is IndoorNode => n !== undefined);

  const distFromStart: number[] = [0];
  for (let i = 1; i < pathNodes.length; i++) {
    const w = getEdgeWeight(adjacency, pathNodes[i - 1].id, pathNodes[i].id);
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

  return {
    segments,
    steps: buildSteps(pathNodes, distFromStart, adjacency),
    totalDistance: result.distance,
    startFloor: startNode.floor,
    endFloor: endNode.floor,
  };
}

export function getFloorBounds(
  buildingCode: string,
  floor: number,
): { width: number; height: number } {
  const floorData = ALL_FLOOR_DATA.find((f) => {
    const first = f.nodes[0] as IndoorNode | undefined;
    return first?.buildingId === buildingCode && first?.floor === floor;
  });

  if (!floorData) return { width: 2000, height: 1500 };

  let maxX = 0;
  let maxY = 0;
  for (const n of floorData.nodes as IndoorNode[]) {
    if (n.x > maxX) maxX = n.x;
    if (n.y > maxY) maxY = n.y;
  }

  return { width: maxX + 200, height: maxY + 200 };
}
