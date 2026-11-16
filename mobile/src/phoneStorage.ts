// The sync engine and Studium's storage code read and write synchronously (they were written for localStorage).
// On a phone this keeps everything in memory, loaded from AsyncStorage once at start, and writes through.
import AsyncStorage from "@react-native-async-storage/async-storage";

export async function loadPhoneStorage(): Promise<Storage> {
  const keys = await AsyncStorage.getAllKeys();
  const pairs = await AsyncStorage.multiGet(keys);
  const map = new Map<string, string>();
  for (const [k, v] of pairs) if (v !== null) map.set(k, v);
  const keep = (p: Promise<unknown>) => void p.catch(() => undefined); // the in-memory copy is what the app uses
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
      keep(AsyncStorage.clear());
    },
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem(k: string) {
      map.delete(k);
      keep(AsyncStorage.removeItem(k));
    },
    setItem(k: string, v: string) {
      map.set(k, String(v));
      keep(AsyncStorage.setItem(k, String(v)));
    },
  };
}
