export function parseClassLocation(raw?: string | null): string | null {
    if (!raw) return null;

    const s = raw.trim();

    const isAsciiLetterCode = (code: number) =>
        (code >= 65 && code <= 90) || (code >= 97 && code <= 122);

    const isAsciiDigitCode = (code: number) => code >= 48 && code <= 57;

    const isAsciiAlphaNumCode = (code: number) =>
        isAsciiLetterCode(code) || isAsciiDigitCode(code);

    const codeAt = (value: string, index: number) =>
        value.codePointAt(index) ?? -1;

    for (let i = 0; i < s.length; i += 1) {
        const current = codeAt(s, i);
        if (!isAsciiLetterCode(current)) continue;
        if (i > 0 && isAsciiAlphaNumCode(codeAt(s, i - 1))) continue;

        let cursor = i;
        while (
            cursor < s.length &&
            isAsciiLetterCode(codeAt(s, cursor)) &&
            cursor - i < 4
        ) {
            cursor += 1;
        }

        if (cursor === i) continue;
        if (cursor < s.length && isAsciiLetterCode(codeAt(s, cursor))) continue;

        const building = s.slice(i, cursor);

        while (cursor < s.length && s[cursor] === " ") cursor += 1;
        if (s[cursor] === "-") {
            cursor += 1;
            while (cursor < s.length && s[cursor] === " ") cursor += 1;
        }

        const roomStart = cursor;
        let digitCount = 0;

        while (
            cursor < s.length &&
            isAsciiDigitCode(codeAt(s, cursor)) &&
            digitCount < 4
        ) {
            cursor += 1;
            digitCount += 1;
        }

        if (digitCount === 0) continue;
        if (cursor < s.length && isAsciiDigitCode(codeAt(s, cursor))) continue;

        if (cursor < s.length && isAsciiLetterCode(codeAt(s, cursor))) {
            cursor += 1;
        }
        if (cursor < s.length && isAsciiLetterCode(codeAt(s, cursor))) continue;
        if (cursor < s.length && isAsciiAlphaNumCode(codeAt(s, cursor))) continue;

        const room = s.slice(roomStart, cursor);
        return `${building.toUpperCase()}-${room.toUpperCase()}`;
    }

    return s;
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