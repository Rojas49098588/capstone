// The one place the real Firebase is started. Null means this build has no Firebase config, so sync is off.
// Firebase is loaded only when needed, in its own chunk, so guests' first load stays small.
import type { FirebaseOptions } from "firebase/app";
import type { AuthClient } from "./auth";
import { FIREBASE_CONFIG } from "./config";
import type { BrowserSignIn } from "./firebaseAuth";
import type { RemoteStore } from "./remote";

export type Services = { auth: AuthClient; remote: RemoteStore };

let started: Promise<Services | null> | null = null;

async function start(config: FirebaseOptions, opts: { browserSignIn?: BrowserSignIn }): Promise<Services> {
  const [{ initializeApp }, { createFirebaseAuth }, { createFirestoreRemote }] = await Promise.all([
    import("firebase/app"),
    import("./firebaseAuth"),
    import("./firestoreRemote"),
  ]);
  const app = initializeApp(config);
  return { auth: createFirebaseAuth(app, opts), remote: createFirestoreRemote(app) };
}

/**
 * Starts Firebase once: every call returns the same promise, so React StrictMode's second effect
 * can't initialize Firestore twice. A failed start is forgotten, so a later call can try again.
 */
export function createFirebaseServices(opts: { browserSignIn?: BrowserSignIn } = {}): Promise<Services | null> {
  if (FIREBASE_CONFIG === null) return Promise.resolve(null);
  if (!started) {
    started = start(FIREBASE_CONFIG, opts);
    started.catch(() => {
      started = null;
    });
  }
  return started;
}
