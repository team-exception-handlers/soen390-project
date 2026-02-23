const React = require("react");
const path = require("path");

// Mock Lucide Icons and components as strings
jest.mock("lucide-react-native", () => ({
    Bus: "Bus",
    Footprints: "Footprints",
    MapPin: "MapPin",
    ActivityIndicator: "ActivityIndicator",
}));

jest.mock("react-native", () => ({
    View: "View",
    Text: "Text",
    TouchableOpacity: "TouchableOpacity",
    ScrollView: "ScrollView",
    ActivityIndicator: "ActivityIndicator",
    StyleSheet: { create: (s) => s },
    Platform: { OS: "ios" },
}));

// Mock timers
global.setInterval = jest.fn(() => 123);
global.clearInterval = jest.fn();

// Mock dependencies
jest.mock("../../utils/locationLogic", () => ({
    getNearestStop: jest.fn(() => ({ stop: "SGW", destination: "LOY" })),
    STOPS: {
        SGW: { latitude: 45.4972, longitude: -73.5789 },
        LOY: { latitude: 45.4582, longitude: -73.6391 },
    },
}));

jest.mock("../../utils/osrmDirections", () => ({
    fetchOsrmRoute: jest.fn(() => Promise.resolve({ durationSeconds: 600 })),
}));

jest.mock("../../utils/shuttleLogic", () => ({
    getShuttleInfo: jest.fn(() => ({
        nextDeparture: "10:00",
        nextThreeDepartures: ["10:00", "10:30"],
        estimatedArrival: "10:30",
        serviceUnavailable: false,
    })),
    calculateArrivalTime: jest.fn(() => "10:30"),
}));

// Mock React
let mockStates = [];
let mockStateIdx = 0;

jest.mock("react", () => {
    const Actual = jest.requireActual("react");
    return {
        ...Actual,
        useState: (init) => {
            const idx = mockStateIdx++;
            if (mockStates[idx] === undefined) mockStates[idx] = init;
            return [mockStates[idx], (v) => { mockStates[idx] = v; }];
        },
        useEffect: (fn) => { },
        useRef: (init) => ({ current: init }),
        useCallback: (fn) => fn,
    };
});

const ShuttleDirections = require("../../components/ShuttleDirections").default;

describe("components/ShuttleDirections", () => {

    function expand(node) {
        if (node == null || typeof node === "boolean") return null;
        if (typeof node === "string" || typeof node === "number") return node;
        if (Array.isArray(node)) return node.map(expand).filter(x => x !== null);

        if (typeof node === "object" && node.$$typeof) {
            const { type, props } = node;
            if (typeof type === "function") return expand(type(props || {}));
            if (typeof type === "string") {
                const newProps = { ...(props || {}) };
                if (newProps.children !== undefined) newProps.children = expand(newProps.children);
                return { type, props: newProps };
            }
        }
        return null;
    }

    function textFrom(node) {
        if (node == null) return "";
        if (typeof node === "string" || typeof node === "number") return String(node);
        if (Array.isArray(node)) return node.map(textFrom).join("");
        if (typeof node === "object" && node.props?.children != null) return textFrom(node.props.children);
        return "";
    }

    function findByText(node, regex) {
        if (!node) return null;
        if (Array.isArray(node)) {
            for (const child of node) {
                const res = findByText(child, regex);
                if (res) return res;
            }
            return null;
        }
        if (typeof node === "object") {
            const t = textFrom(node);
            if (regex.test(t)) return node;
            if (node.props && node.props.children) return findByText(node.props.children, regex);
        }
        return null;
    }

    beforeEach(() => {
        jest.clearAllMocks();
        mockStates = [];
        mockStateIdx = 0;
    });

    test("renders loading state", () => {
        mockStates = [null, null, "", true, null];
        const tree = expand(React.createElement(ShuttleDirections, { origin: null, destination: null }));
        expect(findByText(tree, /Planning your journey/)).toBeTruthy();
    });

    test("renders error state", () => {
        mockStates = [null, null, "", false, "Mock Error"];
        const tree = expand(React.createElement(ShuttleDirections, { origin: {}, destination: {} }));
        expect(findByText(tree, /Mock Error/)).toBeTruthy();
    });

    test("renders service unavailable branch", () => {
        mockStates = [
            { serviceUnavailable: true, message: "Weekend" },
            null, "", false, null
        ];
        const tree = expand(React.createElement(ShuttleDirections, { origin: {}, destination: {} }));
        expect(findByText(tree, /Weekend/)).toBeTruthy();
    });
});
