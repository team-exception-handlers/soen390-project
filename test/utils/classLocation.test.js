const {
    parseClassLocation,
    parseLocationParts,
    readBuilding,
    readRoom,
    isValidRoomEnding,
    tryParseLocationAt
} = require("../../utils/classLocation");

describe("parseClassLocation", () => {
    test("returns null when input is missing", () => {
        expect(parseClassLocation(undefined)).toBeNull();
        expect(parseClassLocation(null)).toBeNull();
        expect(parseClassLocation("")).toBeNull();
    });

    test("parses standard building-room format", () => {
        expect(parseClassLocation("H-510")).toBe("H-510");
        expect(parseClassLocation("MB-2")).toBe("MB-2");
    });

    test("normalizes lowercase input", () => {
        expect(parseClassLocation("h-510")).toBe("H-510");
        expect(parseClassLocation("mb-s2.330")).toBe("MB-S2.330");
    });

    test("handles spaces around hyphen", () => {
        expect(parseClassLocation("H - 510")).toBe("H-510");
        expect(parseClassLocation("MB - S2.330")).toBe("MB-S2.330");
    });

    test("supports classrooms with decimal room numbers", () => {
        expect(parseClassLocation("EV-1.605")).toBe("EV-1.605");
        expect(parseClassLocation("MB-2.330")).toBe("MB-2.330");
    });

    test("supports classrooms with a letter prefix before digits", () => {
        expect(parseClassLocation("MB-S2.330")).toBe("MB-S2.330");
        expect(parseClassLocation("H-S1")).toBe("H-S1");
    });

    test("handles multi-letter building codes", () => {
        expect(parseClassLocation("EV-1")).toBe("EV-1");
        expect(parseClassLocation("VL-101")).toBe("VL-101");
    });

    test("falls back to trimmed input when format is unknown", () => {
        expect(parseClassLocation("Online class")).toBe("Online class");
        expect(parseClassLocation("TBA")).toBe("TBA");
    });

    test("trims whitespace", () => {
        expect(parseClassLocation("   H-510   ")).toBe("H-510");
        expect(parseClassLocation("   MB-S2.330   ")).toBe("MB-S2.330");
    });
});

describe("parseLocationParts", () => {
    test("returns null parts when input is missing", () => {
        expect(parseLocationParts(undefined)).toEqual({
            building: null,
            room: null,
        });

        expect(parseLocationParts(null)).toEqual({
            building: null,
            room: null,
        });
    });

    test("splits building and room correctly", () => {
        expect(parseLocationParts("H-510")).toEqual({
            building: "H",
            room: "510",
        });

        expect(parseLocationParts("MB-2")).toEqual({
            building: "MB",
            room: "2",
        });
    });

    test("supports decimal room numbers", () => {
        expect(parseLocationParts("EV-1.605")).toEqual({
            building: "EV",
            room: "1.605",
        });
    });

    test("supports prefixed room numbers like S2.330", () => {
        expect(parseLocationParts("MB-S2.330")).toEqual({
            building: "MB",
            room: "S2.330",
        });
    });

    test("normalizes input before splitting", () => {
        expect(parseLocationParts("mb - s2.330")).toEqual({
            building: "MB",
            room: "S2.330",
        });
    });

    test("returns building only if no room", () => {
        expect(parseLocationParts("H")).toEqual({
            building: "H",
            room: null,
        });
    });

    test("falls back to raw building text", () => {
        expect(parseLocationParts("Online")).toEqual({
            building: "ONLINE",
            room: null,
        });
    });


});

describe("extra branch coverage for classLocation", () => {
    test("covers readBuilding returning null when no building can be parsed", () => {
        expect(parseClassLocation("1234")).toBe("1234");
        expect(parseClassLocation("-510")).toBe("-510");
    });

    test("rejects malformed classroom numbers with multiple dots", () => {
        expect(parseClassLocation("H-12.34.56")).toBe("H-12.34.56");
    });

    test("covers invalid room ending with extra letters", () => {
        expect(parseClassLocation("H-510AB")).toBe("H-510AB");
    });

    test("covers invalid room ending with alphanumeric after trailing letter", () => {
        expect(parseClassLocation("H-510A7")).toBe("H-510A7");
    });

    test("covers case where building parse is attempted at a non-building position", () => {
        expect(parseClassLocation("Room: 500")).toBe("Room: 500");
    });
});

describe("direct branch coverage", () => {
    test("readBuilding returns null when no building starts at cursor", () => {
        expect(readBuilding("123ABC", 0)).toBeNull();
    });

    test("isValidRoomEnding returns false for trailing alphanumeric", () => {
        expect(isValidRoomEnding("H-510A7", 6)).toBe(false);
    });

    test("readRoom returns null when a digit remains after parsing", () => {
        expect(readRoom("12A7", 0)).toBeNull();
    });

    test("isValidRoomEnding returns true at end of string", () => {
        expect(isValidRoomEnding("H-510", 5)).toBe(true);
    });

});