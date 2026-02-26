export const CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export const SCOPES = [
    "https://www.googleapis.com/auth/calendar.readonly",
    "openid",
    "profile",
    "email",
];

export const CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";