const path = require("node:path");
const React = require("react");

jest.mock("lucide-react-native", () => ({
    Bus: "Bus",
    ChevronDown: "ChevronDown",
    ChevronUp: "ChevronUp",
    Footprints: "Footprints",
    MapPin: "MapPin",
    Train: "Train",
    TramFront: "TramFront",
}));

jest.mock("react-native", () => ({
    Pressable: "Pressable",
    Text: "Text",
    View: "View",
}));

describe("components/TransitLegTimeline.tsx (no renderer dependency)", () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    function loadComponent() {
        return require(path.join(__dirname, "..", "..", "components", "TransitLegTimeline.tsx")).default;
    }

    function expand(node) {
        if (node == null || typeof node === "boolean") return null;

        // Text nodes that are plain strings/numbers
        if (typeof node === "string" || typeof node === "number") return node;

        // Arrays of children
        if (Array.isArray(node)) {
            const out = node.map(expand).filter((x) => x !== null);
            return out;
        }

        // React element
        if (typeof node === "object" && node.$$typeof) {
            const { type, props } = node;

            // React.Fragment
            if (type === React.Fragment) {
                return expand(props?.children);
            }

            // Function component
            if (typeof type === "function") {
                return expand(type(props || {}));
            }

            // Host component
            if (typeof type === "string") {
                const newProps = { ...(props || {}) };
                if (newProps.children !== undefined) {
                    newProps.children = expand(newProps.children);
                }
                return { type, props: newProps };
            }
        }

        return null;
    }

    function textFrom(node) {
        if (node == null) return "";
        if (typeof node === "string" || typeof node === "number") return String(node);
        if (Array.isArray(node)) return node.map(textFrom).join("");
        if (typeof node === "object" && node.type === "Text") return textFrom(node.props?.children);
        if (typeof node === "object" && node.props?.children != null) return textFrom(node.props.children);
        return "";
    }

    function findInArray(arr, regex) {
        for (const child of arr) {
            const res = findByText(child, regex);
            if (res) return res;
        }
        return null;
    }

    function findInObject(node, regex) {
        if (node.type === "Text") {
            const t = textFrom(node);
            if (regex.test(t)) return node;
        }
        if (node.props && node.props.children) {
            return findByText(node.props.children, regex);
        }
        return null;
    }

    function findByText(node, regex) {
        if (!node) return null;
        if (Array.isArray(node)) return findInArray(node, regex);
        if (typeof node === "object") return findInObject(node, regex);
        return null;
    }

    function findAllInArray(arr, type, acc) {
        for (const child of arr) {
            findAllByType(child, type, acc);
        }
    }

    function findAllInObject(node, type, acc) {
        if (node.type === type) acc.push(node);
        if (node.props && node.props.children) {
            findAllByType(node.props.children, type, acc);
        }
    }

    function findAllByType(node, type, acc = []) {
        if (!node) return acc;
        if (Array.isArray(node)) {
            findAllInArray(node, type, acc);
        } else if (typeof node === "object") {
            findAllInObject(node, type, acc);
        }
        return acc;
    }

    function expectText(tree, regex) {
        const found = findByText(tree, regex);
        expect(found).toBeTruthy();
        return found;
    }

    function expectNoText(tree, regex) {
        const found = findByText(tree, regex);
        expect(found).toBeNull();
    }

    const formatTime = jest.fn((iso) => {
        const d = new Date(iso);
        const hh = String(d.getUTCHours()).padStart(2, "0");
        const mm = String(d.getUTCMinutes()).padStart(2, "0");
        return `${hh}:${mm}`;
    });

    const styles = {
        timelineContainer: {},
        timelineLeft: {},
        timelineCenter: {},
        timelineRight: {},
        timelineTime: {},
        timelineIcon: {},
        timelineIconWalk: {},
        timelineIconTransit: {},
        timelineLine: {},
        timelineLineWalk: {},
        timelineLineTransit: {},
        timelineStopName: {},
        timelineWalkDetail: {},
        timelineRoutePill: {},
        timelineRoutePillBus: {},
        timelineRoutePillSubway: {},
        timelineRoutePillTram: {},
        timelineRouteText: {},
        timelineHeadsign: {},
    };

    test("WALK first leg shows 'Now' and walk details", () => {
        const TransitLegTimeline = loadComponent();

        const itinerary = {
            legs: [
                {
                    mode: "WALK",
                    from: { name: "START" },
                    to: { name: "Stop A" },
                    startTime: "2026-02-19T17:06:00Z",
                    endTime: "2026-02-19T17:20:00Z",
                    distance: 978,
                    duration: 840, // 14 min
                },
            ],
        };

        const tree = expand(
            React.createElement(TransitLegTimeline, {
                itinerary,
                styles,
                formatTime,
                stopKeyPrefix: "p",
            }),
        );

        expectText(tree, /\bNow\b/);
        expectText(tree, /\bSTART\b/);
        expectText(tree, /14 min Walk 978 m/);

        // icon branch
        expect(findAllByType(tree, "Footprints").length).toBeGreaterThan(0);
    });

    test("BUS leg renders Departs, route, headsign", () => {
        const TransitLegTimeline = loadComponent();

        const itinerary = {
            legs: [
                {
                    mode: "BUS",
                    from: { name: "Station A" },
                    to: { name: "Station B" },
                    startTime: "2026-02-19T17:20:00Z",
                    endTime: "2026-02-19T17:29:00Z",
                    distance: 5000,
                    duration: 540,
                    route: "105",
                    headsign: "East",
                },
            ],
        };

        const tree = expand(
            React.createElement(TransitLegTimeline, {
                itinerary,
                styles,
                formatTime,
                stopKeyPrefix: "p",
            }),
        );

        expectText(tree, /Departs 17:20/);
        expectText(tree, /\b105\b/);
        expectText(tree, /→ East/);

        // Bus icon branches (LegIcon + RouteIcon)
        expect(findAllByType(tree, "Bus").length).toBeGreaterThan(0);
    });

    test("SUBWAY leg renders route; headsign omitted when missing", () => {
        const TransitLegTimeline = loadComponent();

        const itinerary = {
            legs: [
                {
                    mode: "SUBWAY",
                    from: { name: "Metro A" },
                    to: { name: "Metro B" },
                    startTime: "2026-02-19T17:00:00Z",
                    endTime: "2026-02-19T17:20:00Z",
                    distance: 5000,
                    duration: 1200,
                    route: "Green",
                },
            ],
        };

        const tree = expand(
            React.createElement(TransitLegTimeline, {
                itinerary,
                styles,
                formatTime,
                stopKeyPrefix: "p",
            }),
        );

        expectText(tree, /\bMetro A\b/);
        expectText(tree, /\bGreen\b/);
        expectNoText(tree, /→/);

        expect(findAllByType(tree, "Train").length).toBeGreaterThan(0);
    });

    test("TRAM leg hits default branches and renders route", () => {
        const TransitLegTimeline = loadComponent();

        const itinerary = {
            legs: [
                {
                    mode: "TRAM",
                    from: { name: "Tram A" },
                    to: { name: "Tram B" },
                    startTime: "2026-02-19T17:00:00Z",
                    endTime: "2026-02-19T17:10:00Z",
                    distance: 2000,
                    duration: 600,
                    route: "T1",
                },
            ],
        };

        const tree = expand(
            React.createElement(TransitLegTimeline, {
                itinerary,
                styles,
                formatTime,
                stopKeyPrefix: "p",
            }),
        );

        expectText(tree, /\bTram A\b/);
        expectText(tree, /\bT1\b/);
        expect(findAllByType(tree, "TramFront").length).toBeGreaterThan(0);
    });

    test("alwaysShowIntermediateStops=true shows count label and renders intermediate stop rows (plural + singular)", () => {
        const TransitLegTimeline = loadComponent();

        const itineraryPlural = {
            legs: [
                {
                    mode: "BUS",
                    from: { name: "A" },
                    to: { name: "B" },
                    startTime: "2026-02-19T17:00:00Z",
                    endTime: "2026-02-19T17:30:00Z",
                    distance: 5000,
                    duration: 1800,
                    route: "105",
                    intermediateStops: [
                        { name: "Stop 1", arrival: "2026-02-19T17:10:00Z" },
                        { name: "Stop 2", arrival: "2026-02-19T17:20:00Z" },
                    ],
                },
            ],
        };

        const treePlural = expand(
            React.createElement(TransitLegTimeline, {
                itinerary: itineraryPlural,
                styles,
                formatTime,
                alwaysShowIntermediateStops: true,
                stopKeyPrefix: "p",
            }),
        );

        expectText(treePlural, /2 intermediate stops/i);
        expectText(treePlural, /\bStop 1\b/);
        expectText(treePlural, /\bStop 2\b/);
        expectText(treePlural, /\b17:10\b/);
        expectText(treePlural, /\b17:20\b/);

        const itinerarySingular = {
            legs: [
                {
                    mode: "BUS",
                    from: { name: "A" },
                    to: { name: "B" },
                    startTime: "2026-02-19T17:00:00Z",
                    endTime: "2026-02-19T17:30:00Z",
                    distance: 5000,
                    duration: 1800,
                    route: "105",
                    intermediateStops: [{ name: "Only Stop", arrival: "2026-02-19T17:10:00Z" }],
                },
            ],
        };

        const treeSingular = expand(
            React.createElement(TransitLegTimeline, {
                itinerary: itinerarySingular,
                styles,
                formatTime,
                alwaysShowIntermediateStops: true,
                stopKeyPrefix: "p",
            }),
        );

        expectText(treeSingular, /1 intermediate stop\b/i);
        expectText(treeSingular, /\bOnly Stop\b/);
    });

    test("toggle mode: collapsed shows ChevronDown + label; press calls onToggleStops; expanded shows ChevronUp + list", () => {
        const TransitLegTimeline = loadComponent();

        const itinerary = {
            legs: [
                {
                    mode: "BUS",
                    from: { name: "A" },
                    to: { name: "B" },
                    startTime: "2026-02-19T17:00:00Z",
                    endTime: "2026-02-19T17:30:00Z",
                    distance: 5000,
                    duration: 1800,
                    route: "105",
                    intermediateStops: [
                        { name: "Stop 1", arrival: "2026-02-19T17:10:00Z" },
                        { name: "Stop 2", arrival: "2026-02-19T17:20:00Z" },
                    ],
                },
            ],
        };

        const onToggleStops = jest.fn();

        const treeCollapsed = expand(
            React.createElement(TransitLegTimeline, {
                itinerary,
                styles,
                formatTime,
                canToggleIntermediateStops: true,
                expandedStops: new Set(),
                onToggleStops,
                stopKeyPrefix: "prefix",
            }),
        );

        expectText(treeCollapsed, /2 intermediate stops? \(30 min\)/i);
        expect(findAllByType(treeCollapsed, "ChevronDown").length).toBeGreaterThan(0);
        expect(findAllByType(treeCollapsed, "ChevronUp").length).toBe(0);
        expectNoText(treeCollapsed, /\bStop 1\b/);

        const pressables = findAllByType(treeCollapsed, "Pressable");
        expect(pressables.length).toBeGreaterThan(0);

        // Simulate press to expand
        pressables[0].props.onPress();
        expect(onToggleStops).toHaveBeenCalledWith("prefix-0");

        const treeExpanded = expand(
            React.createElement(TransitLegTimeline, {
                itinerary,
                styles,
                formatTime,
                canToggleIntermediateStops: true,
                expandedStops: new Set(["prefix-0"]),
                onToggleStops,
                stopKeyPrefix: "prefix",
            }),
        );

        expect(findAllByType(treeExpanded, "ChevronUp").length).toBeGreaterThan(0);
        expectText(treeExpanded, /\bStop 1\b/);
        expectText(treeExpanded, /\bStop 2\b/);
    });

    test("when toggle disabled and alwaysShowIntermediateStops=false, intermediate stop UI is null", () => {
        const TransitLegTimeline = loadComponent();

        const itinerary = {
            legs: [
                {
                    mode: "BUS",
                    from: { name: "A" },
                    to: { name: "B" },
                    startTime: "2026-02-19T17:00:00Z",
                    endTime: "2026-02-19T17:30:00Z",
                    distance: 5000,
                    duration: 1800,
                    route: "105",
                    intermediateStops: [{ name: "Hidden Stop", arrival: "2026-02-19T17:10:00Z" }],
                },
            ],
        };

        const tree = expand(
            React.createElement(TransitLegTimeline, {
                itinerary,
                styles,
                formatTime,
                alwaysShowIntermediateStops: false,
                canToggleIntermediateStops: false,
                stopKeyPrefix: "p",
            }),
        );

        expectNoText(tree, /intermediate stop/i);
        expectNoText(tree, /\bHidden Stop\b/);
    });

    test("walk arrival row renders for WALK not last; final destination row renders for last leg (MapPin + destination)", () => {
        const TransitLegTimeline = loadComponent();

        const itinerary = {
            legs: [
                {
                    mode: "WALK",
                    from: { name: "Start" },
                    to: { name: "Stop A" },
                    startTime: "2026-02-19T17:00:00Z",
                    endTime: "2026-02-19T17:10:00Z",
                    distance: 500,
                    duration: 600,
                },
                {
                    mode: "BUS",
                    from: { name: "Stop A" },
                    to: { name: "END" },
                    startTime: "2026-02-19T17:15:00Z",
                    endTime: "2026-02-19T17:30:00Z",
                    distance: 2000,
                    duration: 900,
                    route: "105",
                },
            ],
        };

        const tree = expand(
            React.createElement(TransitLegTimeline, {
                itinerary,
                styles,
                formatTime,
                stopKeyPrefix: "p",
            }),
        );

        expectText(tree, /Arrive at stop/i);
        expectText(tree, /\bStop A\b/);

        expect(findAllByType(tree, "MapPin").length).toBeGreaterThan(0);
        expectText(tree, /\bEND\b/);
    });
});