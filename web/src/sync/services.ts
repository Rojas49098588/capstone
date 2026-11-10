// The one place the real Firebase is started. Null means this build has no Firebase config, so sync is off.
// Firebase is loaded only when needed, in its own chunk, so guests' first load stays small.
import type { FirebaseApp } from "firebase/app";
import type { AuthClient } from "./auth";
import { FIREBASE_CONFIG } from "./config";
import type { BrowserSignIn } from "./firebaseAuth";
import type { RemoteStore } from "./remote";

export type Services = { auth: AuthClient; remote: RemoteStore };

let app: FirebaseApp | null = null;

export async function createFirebaseServices(opts: { browserSignIn?: BrowserSignIn } = {}): Promise<Services | null> {
  if (FIREBASE_CONFIG === null) return null;
  const [{ initializeApp }, { createFirebaseAuth }, { createFirestoreRemote }] = await Promise.all([
    import("firebase/app"),
    import("./firebaseAuth"),
    import("./firestoreRemote"),
  ]);
  app ??= initializeApp(FIREBASE_CONFIG);
  return { auth: createFirebaseAuth(app, opts), remote: createFirestoreRemote(app) };
}
