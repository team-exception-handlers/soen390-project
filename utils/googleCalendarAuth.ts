/**
 * Secure storage layer for Google Calendar OAuth tokens.
 *
 * Uses expo-secure-store on native platforms (iOS Keychain / Android Keystore)
 * and falls back to AsyncStorage on web (where SecureStore is unavailable).
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const TOKEN_KEY = "google_access_token";
const TOKEN_EXPIRY_KEY = "google_access_token_expiry";

/** Buffer in seconds before the declared expiry when we treat a token as expired. */
const EXPIRY_BUFFER_SECONDS = 60;

const isNative = Platform.OS !== "web";

async function secureSet(key: string, value: string): Promise<void> {
  if (isNative) {
    await SecureStore.setItemAsync(key, value);
  } else {
    await AsyncStorage.setItem(key, value);
  }
}

async function secureGet(key: string): Promise<string | null> {
  if (isNative) {
    return await SecureStore.getItemAsync(key);
  }
  return await AsyncStorage.getItem(key);
}

async function secureDelete(key: string): Promise<void> {
  if (isNative) {
    await SecureStore.deleteItemAsync(key);
  } else {
    await AsyncStorage.removeItem(key);
  }
}

/**
 * Persist an access token.
 * @param token     The OAuth access token string.
 * @param expiresIn Lifetime in seconds as reported by the auth server (optional).
 *                  When provided, the token will be treated as expired
 *                  EXPIRY_BUFFER_SECONDS before its declared expiry.
 */
export async function saveToken(
  token: string,
  expiresIn?: number,
): Promise<void> {
  await secureSet(TOKEN_KEY, token);

  if (expiresIn && expiresIn > 0) {
    const expiryMs = Date.now() + (expiresIn - EXPIRY_BUFFER_SECONDS) * 1000;
    await secureSet(TOKEN_EXPIRY_KEY, String(expiryMs));
  }
}

/**
 * Retrieve the stored access token.
 * Returns `null` if no token exists or if the token has expired.
 * Expired tokens are automatically cleared from storage.
 */
export async function getToken(): Promise<string | null> {
  const [token, expiryRaw] = await Promise.all([
    secureGet(TOKEN_KEY),
    secureGet(TOKEN_EXPIRY_KEY),
  ]);

  if (!token) return null;

  if (expiryRaw && Date.now() >= Number(expiryRaw)) {
    await clearToken();
    return null;
  }

  return token;
}

/**
 * Remove the access token and expiry record from secure storage.
 * Call this on sign-out or when a 401 error is received.
 */
export async function clearToken(): Promise<void> {
  await Promise.all([secureDelete(TOKEN_KEY), secureDelete(TOKEN_EXPIRY_KEY)]);
}

/**
 * Returns `true` if the HTTP status code indicates an expired/invalid token.
 */
export function isAuthError(status: number): boolean {
  return status === 401;
}
