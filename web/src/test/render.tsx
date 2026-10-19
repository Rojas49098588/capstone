// Test helpers for components. Importing this file also registers RTL cleanup.
import { cleanup, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach } from "vitest";
import { NOW } from "../planner/testData";
import type { StudiumData } from "../planner/types";
import { recordFocusSessions } from "../store/actions";
import { buildSeed } from "../store/seed";
import { STORAGE_KEY, saveData } from "../store/storage";
import { StudiumProvider } from "../store/useStudium";

afterEach(cleanup);

/** An in-memory Storage. */
export function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
  } as Storage;
}

/** Renders `ui` inside a StudiumProvider with saved data (the example data by default) and a fixed clock. */
export function renderWithStudium(
  ui: ReactElement,
  o: { data?: StudiumData; now?: Date; storage?: Storage | null } = {},
) {
  const now = o.now ?? NOW;
  const storage = o.storage === null ? null : (o.storage ?? memoryStorage());
  if (storage) saveData(storage, o.data ?? buildSeed(now));
  const result = render(<StudiumProvider options={{ storage, clock: () => now }}>{ui}</StudiumProvider>);
  return { ...result, storage };
}

/** What the provider last saved. */
export function savedData(storage: Storage | null): StudiumData {
  return JSON.parse(storage?.getItem(STORAGE_KEY) ?? "null") as StudiumData;
}

/** The example data plus one focus session (a nap) on a webDev task, ended at `at`. */
export function withFocus(minutes: number, taskId: string | null = "webDev-t5", at: Date = NOW): StudiumData {
  const session = {
    id: `focus-${minutes}-${at.getTime()}`,
    projectId: "webDev",
    taskId,
    startedAt: new Date(at.getTime() - minutes * 60_000).toISOString(),
    at: at.toISOString(),
    minutes,
  };
  return recordFocusSessions(buildSeed(NOW), [session], NOW).data;
}
