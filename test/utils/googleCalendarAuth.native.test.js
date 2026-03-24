/**
 * Native path: googleCalendarAuth uses expo-secure-store (Platform.OS !== "web").
 * Split from web so Platform is fixed at module load.
 */

jest.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

jest.mock("expo-secure-store", () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

const SecureStore = require("expo-secure-store");
const {
  saveToken,
  getToken,
  clearToken,
  isAuthError,
} = require("../../utils/googleCalendarAuth");

describe("googleCalendarAuth (native)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("saveToken stores token via SecureStore", async () => {
    await saveToken("access-xyz");

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "google_access_token",
      "access-xyz",
    );
    expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
  });

  test("saveToken stores expiry when expiresIn is positive", async () => {
    jest.spyOn(Date, "now").mockReturnValue(1_000_000_000_000);
    await saveToken("tok", 3600);

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "google_access_token",
      "tok",
    );
    const expiryCall = SecureStore.setItemAsync.mock.calls.find(
      (c) => c[0] === "google_access_token_expiry",
    );
    expect(expiryCall).toBeDefined();
    const expiryMs = Number(expiryCall[1]);
    expect(expiryMs).toBeGreaterThan(1_000_000_000_000);
    Date.now.mockRestore();
  });

  test("saveToken skips expiry when expiresIn is missing or non-positive", async () => {
    await saveToken("a");
    expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);

    jest.clearAllMocks();
    await saveToken("b", 0);
    expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
  });

  test("getToken returns null when no token stored", async () => {
    SecureStore.getItemAsync.mockResolvedValue(null);

    await expect(getToken()).resolves.toBeNull();
  });

  test("getToken returns token when no expiry row exists", async () => {
    SecureStore.getItemAsync.mockImplementation((key) => {
      if (key === "google_access_token") return Promise.resolve("ok");
      return Promise.resolve(null);
    });

    await expect(getToken()).resolves.toBe("ok");
  });

  test("getToken clears storage and returns null when expired", async () => {
    jest.spyOn(Date, "now").mockReturnValue(5_000);
    SecureStore.getItemAsync.mockImplementation((key) => {
      if (key === "google_access_token") return Promise.resolve("old");
      if (key === "google_access_token_expiry")
        return Promise.resolve(String(4_000));
      return Promise.resolve(null);
    });

    await expect(getToken()).resolves.toBeNull();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
      "google_access_token",
    );
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
      "google_access_token_expiry",
    );
    Date.now.mockRestore();
  });

  test("getToken returns token when expiry is in the future", async () => {
    jest.spyOn(Date, "now").mockReturnValue(1_000);
    SecureStore.getItemAsync.mockImplementation((key) => {
      if (key === "google_access_token") return Promise.resolve("fresh");
      if (key === "google_access_token_expiry")
        return Promise.resolve(String(9_999_999));
      return Promise.resolve(null);
    });

    await expect(getToken()).resolves.toBe("fresh");
    Date.now.mockRestore();
  });

  test("clearToken removes token and expiry", async () => {
    await clearToken();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
      "google_access_token",
    );
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
      "google_access_token_expiry",
    );
  });

  test("isAuthError is true only for 401", () => {
    expect(isAuthError(401)).toBe(true);
    expect(isAuthError(403)).toBe(false);
    expect(isAuthError(200)).toBe(false);
  });
});
