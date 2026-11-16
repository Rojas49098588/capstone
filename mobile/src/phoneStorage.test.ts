import AsyncStorage from "@react-native-async-storage/async-storage";
import { loadPhoneStorage } from "./phoneStorage";

jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

beforeEach(() => AsyncStorage.clear());

test("values are read back at once, kept in AsyncStorage, and there on the next start", async () => {
  const storage = await loadPhoneStorage();
  storage.setItem("studium-data-v1", "{}");
  expect(storage.getItem("studium-data-v1")).toBe("{}");
  expect(storage.length).toBe(1);
  await new Promise((r) => setTimeout(r, 0));
  expect(await AsyncStorage.getItem("studium-data-v1")).toBe("{}");
  const next = await loadPhoneStorage();
  expect(next.getItem("studium-data-v1")).toBe("{}");
  next.removeItem("studium-data-v1");
  await new Promise((r) => setTimeout(r, 0));
  expect(await AsyncStorage.getItem("studium-data-v1")).toBeNull();
});
