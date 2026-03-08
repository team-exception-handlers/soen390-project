function isAsciiLetterCode(code: number): boolean {
    return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function isAsciiDigitCode(code: number): boolean {
    return code >= 48 && code <= 57;
}

function isAsciiAlphaNumCode(code: number): boolean {
    return isAsciiLetterCode(code) || isAsciiDigitCode(code);
}

function codeAt(value: string, index: number): number {
    return value.codePointAt(index) ?? -1;
}

function skipSpaces(value: string, start: number): number {
    let cursor = start;
    while (cursor < value.length && value[cursor] === " ") {
        cursor += 1;
    }
    return cursor;
}

export function readBuilding(value: string, start: number): { building: string; cursor: number } | null {
    let cursor = start;

    while (
        cursor < value.length &&
        isAsciiLetterCode(codeAt(value, cursor)) &&
        cursor - start < 4
    ) {
        cursor += 1;
    }

    if (cursor === start) {
        return null;
    }

    return {
        building: value.slice(start, cursor),
        cursor,
    };
}

function readOptionalLeadingLetter(value: string, start: number): number {
    if (start < value.length && isAsciiLetterCode(codeAt(value, start))) {
        return start + 1;
    }
    return start;
}

function readNumericRoomBody(
    value: string,
    start: number,
): { cursor: number; digitCount: number } {
    let cursor = start;
    let digitCount = 0;
    let dotCount = 0;

    while (cursor < value.length) {
        const char = value[cursor];
        const code = codeAt(value, cursor);

        if (isAsciiDigitCode(code)) {
            digitCount += 1;
            cursor += 1;
            continue;
        }

        if (char === "." && dotCount === 0) {
            dotCount += 1;
            cursor += 1;
            continue;
        }

        break;
    }

    return { cursor, digitCount };
}

export function isValidRoomEnding(value: string, cursor: number): boolean {
    return cursor >= value.length;
}

export function readRoom(
    value: string,
    start: number,
): { room: string; cursor: number } | null {
    const roomStart = start;

    let cursor = readOptionalLeadingLetter(value, start);

    const roomBody = readNumericRoomBody(value, cursor);
    cursor = roomBody.cursor;

    if (roomBody.digitCount === 0) {
        return null;
    }

    if (!isValidRoomEnding(value, cursor)) {
        return null;
    }

    return {
        room: value.slice(roomStart, cursor),
        cursor,
    };
}

export function tryParseLocationAt(value: string, start: number): string | null {
    const current = codeAt(value, start);

    if (!isAsciiLetterCode(current)) {
        return null;
    }

    if (start > 0 && isAsciiAlphaNumCode(codeAt(value, start - 1))) {
        return null;
    }

    const buildingResult = readBuilding(value, start);
    let cursor = skipSpaces(value, buildingResult!.cursor);

    if (value[cursor] === "-") {
        cursor += 1;
        cursor = skipSpaces(value, cursor);
    }

    const roomResult = readRoom(value, cursor);
    if (!roomResult) {
        return null;
    }

    return `${buildingResult!.building.toUpperCase()}-${roomResult.room.toUpperCase()}`;
}

export function parseClassLocation(raw?: string | null): string | null {
    if (!raw) {
        return null;
    }

    const value = raw.trim();

    for (let i = 0; i < value.length; i += 1) {
        const parsed = tryParseLocationAt(value, i);
        if (parsed) {
            return parsed;
        }
    }

    return value;
}

export function parseLocationParts(location?: string | null): {
    building: string | null;
    room: string | null;
} {
    const parsed = parseClassLocation(location);
    const raw = parsed?.trim();

    if (!raw) {
        return { building: null, room: null };
    }

    const parts = raw.split("-");
    const building = parts[0]?.trim()?.toUpperCase() || null;
    const room = parts.slice(1).join("-").trim() || null;

    return { building, room };
}

