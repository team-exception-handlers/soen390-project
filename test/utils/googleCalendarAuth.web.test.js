/**
 * Web path: googleCalendarAuth uses AsyncStorage (Platform.OS === "web").
 */

jest.mock("react-native", () => ({
  Platform: { OS: "web" },
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

const AsyncStorage = require("@react-native-async-storage/async-storage");
const SecureStore = require("expo-secure-store");
const {
  saveToken,
  getToken,
  clearToken,
} = require("../../utils/googleCalendarAuth");

describe("googleCalendarAuth (web)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("saveToken uses AsyncStorage, not SecureStore", async () => {
    await saveToken("web-token");

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      "google_access_token",
      "web-token",
    );
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  test("getToken reads via AsyncStorage", async () => {
    AsyncStorage.getItem.mockImplementation((key) => {
      if (key === "google_access_token") return Promise.resolve("w");
      return Promise.resolve(null);
    });

    await expect(getToken()).resolves.toBe("w");
    expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
  });

  test("clearToken uses AsyncStorage.removeItem", async () => {
    await clearToken();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
      "google_access_token",
    );
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
      "google_access_token_expiry",
    );
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });
});
