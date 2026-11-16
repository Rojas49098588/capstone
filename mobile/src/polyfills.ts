// Things the shared web code expects that a phone's JavaScript engine (Hermes) doesn't have.
// Imported first in app/_layout.tsx, before any shared code runs.
import { randomUUID } from "expo-crypto";

// New task, project and event ids (web/src/store/actions.ts newId) use crypto.randomUUID.
const g = globalThis as { crypto?: { randomUUID?: () => string } };
if (typeof g.crypto?.randomUUID !== "function") {
  g.crypto = { ...(g.crypto ?? {}), randomUUID };
}
