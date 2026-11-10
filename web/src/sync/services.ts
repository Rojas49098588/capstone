// The one place the real Firebase is started. Null means this build has no Firebase config, so sync is off.
import { initializeApp, type FirebaseApp } from "firebase/app";
import type { AuthClient } from "./auth";
import { FIREBASE_CONFIG } from "./config";
import { createFirebaseAuth, type BrowserSignIn } from "./firebaseAuth";
import { createFirestoreRemote } from "./firestoreRemote";
import type { RemoteStore } from "./remote";

let app: FirebaseApp | null = null;

export function createFirebaseServices(opts: { browserSignIn?: BrowserSignIn } = {}): { auth: AuthClient; remote: RemoteStore } | null {
  if (FIREBASE_CONFIG === null) return null;
  app ??= initializeApp(FIREBASE_CONFIG);
  return { auth: createFirebaseAuth(app, opts), remote: createFirestoreRemote(app) };
}
