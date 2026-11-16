// The real sign-in and cloud for the phone, from the same Firebase project and code as the web and desktop apps.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createFirebaseAuth } from "@shared/sync/firebaseAuth";
import { FIREBASE_CONFIG } from "@shared/sync/config";
import { createFirestoreRemote } from "@shared/sync/firestoreRemote";
import { initializeApp } from "firebase/app";
import { getReactNativePersistence, initializeAuth } from "firebase/auth"; // see firebase-auth-rn.d.ts

export function createFirebase() {
  if (!FIREBASE_CONFIG) throw new Error("Studium's Firebase config is missing.");
  const app = initializeApp(FIREBASE_CONFIG);
  // Must come before createFirebaseAuth (which calls getAuth): this keeps the person signed in after a restart.
  initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  return { auth: createFirebaseAuth(app), remote: createFirestoreRemote(app, { phone: true }) };
}
