// Test helpers: an account already holding data (pushed by a "computer" device) and a phone signed in to it.
import type { StudiumData } from "@shared/planner/types";
import { liveRecords } from "@shared/sync/merge";
import { fromRecords, type SyncedSettings } from "@shared/sync/records";
import { createSyncEngine } from "@shared/sync/syncEngine";
import { FakeAuth } from "@shared/test/fakeAuth";
import { FakeRemote } from "@shared/test/fakeRemote";
import { createPhoneStudium } from "../phoneStudium";

export const NOW = new Date(2026, 10, 16, 12, 0, 0);
export const EMAIL = "abby@example.com";
export const UID = `u-${EMAIL}`;

export function memory(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

/** A computer already on the account, holding `data`. */
export async function computer(remote: FakeRemote, data: StudiumData) {
  let local: { data: StudiumData; settings: SyncedSettings } = { data, settings: { nickname: "Abby", petInvolvement: "mild", petOrder: "project" } };
  const engine = createSyncEngine({
    remote,
    storage: memory(),
    clock: () => NOW,
    device: "Computer",
    getLocal: () => local,
    applyLocal: (d, s) => {
      local = { data: d, settings: s };
      return true;
    },
  });
  await engine.connect(UID);
  await engine.flush();
  return { engine, data: () => local.data };
}

export async function accountData(remote: FakeRemote): Promise<StudiumData> {
  const r = await remote.load(UID);
  return fromRecords(liveRecords(r!)).data;
}

/** A phone; `clock` defaults to NOW. */
export function phone(remote: FakeRemote, clock: () => Date = () => NOW, auth = new FakeAuth()) {
  return createPhoneStudium({ auth, remote, storage: memory(), clock });
}

/** An account holding `data` and a phone signed in to it. */
export async function signedInPhone(data: StudiumData | null, clock?: () => Date) {
  const remote = new FakeRemote();
  if (data) await computer(remote, data);
  const p = phone(remote, clock);
  await p.signIn(EMAIL, "pw");
  return { remote, phone: p };
}
