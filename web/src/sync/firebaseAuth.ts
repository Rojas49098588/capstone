// Firebase Auth behind the AuthClient interface.
import type { FirebaseApp } from "firebase/app";
import {
  GoogleAuthProvider,
  OAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  type User,
} from "firebase/auth";
import type { Account, AuthClient, AuthError } from "./auth";

export type BrowserSignIn = (provider: "google" | "apple") => Promise<{ idToken: string; accessToken?: string; rawNonce?: string }>;

export function authErrorCode(code: string): AuthError {
  switch (code) {
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "wrong-password";
    case "auth/user-not-found":
      return "no-account";
    case "auth/email-already-in-use":
      return "email-in-use";
    case "auth/weak-password":
      return "weak-password";
    case "auth/network-request-failed":
      return "network";
    case "auth/requires-recent-login":
      return "needs-recent-sign-in";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "cancelled";
    default:
      return "other";
  }
}

function toAccount(u: User): Account {
  const created = u.metadata.creationTime ? new Date(u.metadata.creationTime) : new Date();
  return { uid: u.uid, email: u.email, createdAt: created.toISOString() };
}

/** Run a Firebase call and reject with `{ code }`, the same shape the fake uses. */
async function mapped<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    const code = typeof e === "object" && e !== null && typeof (e as { code?: unknown }).code === "string" ? (e as { code: string }).code : "";
    throw { code: authErrorCode(code) };
  }
}

/** The provider for a button: Apple asks for the person's email and name (Apple only sends the name the first time). */
export function providerFor(name: "google" | "apple"): GoogleAuthProvider | OAuthProvider {
  if (name === "google") return new GoogleAuthProvider();
  const apple = new OAuthProvider("apple.com");
  apple.addScope("email");
  apple.addScope("name");
  return apple;
}

export function createFirebaseAuth(app: FirebaseApp, opts: { browserSignIn?: BrowserSignIn } = {}): AuthClient {
  const auth = getAuth(app);

  async function viaProvider(name: "google" | "apple"): Promise<Account> {
    const provider = providerFor(name);
    if (opts.browserSignIn) {
      // The browser flow rejects with no code when the person backs out.
      const t = await opts.browserSignIn(name).catch((e: unknown) => {
        if (typeof e === "object" && e !== null && typeof (e as { code?: unknown }).code === "string") throw e;
        throw { code: "auth/cancelled-popup-request" };
      });
      const credential =
        provider instanceof GoogleAuthProvider
          ? GoogleAuthProvider.credential(t.idToken, t.accessToken)
          : (provider as OAuthProvider).credential({ idToken: t.idToken, accessToken: t.accessToken, rawNonce: t.rawNonce });
      return toAccount((await signInWithCredential(auth, credential)).user);
    }
    return toAccount((await signInWithPopup(auth, provider)).user);
  }

  return {
    current: () => (auth.currentUser ? toAccount(auth.currentUser) : null),
    onChange: (cb) => onAuthStateChanged(auth, (u) => cb(u ? toAccount(u) : null)),
    signInEmail: (email, password) => mapped(async () => toAccount((await signInWithEmailAndPassword(auth, email, password)).user)),
    createEmail: (email, password) => mapped(async () => toAccount((await createUserWithEmailAndPassword(auth, email, password)).user)),
    resetPassword: (email) => mapped(() => sendPasswordResetEmail(auth, email)),
    signInGoogle: () => mapped(() => viaProvider("google")),
    signInApple: () => mapped(() => viaProvider("apple")),
    signOut: () => mapped(() => auth.signOut()),
    deleteAccount: () =>
      mapped(async () => {
        if (!auth.currentUser) throw { code: "other" };
        await auth.currentUser.delete();
      }),
  };
}
