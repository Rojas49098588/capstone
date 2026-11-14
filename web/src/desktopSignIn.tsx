// The page the desktop app opens in the person's browser to sign in (desktop/src/main/browserSignIn.js).
// The person clicks a button (a popup needs a click, and this tab was opened by the app, not by a click),
// the page signs in with a popup, then hands the tokens to the desktop app's local server.
import { FIREBASE_CONFIG } from "./sync/config";

type Tokens = { idToken: string; accessToken?: string };
export type Provider = "google" | "apple";
type Deps = {
  root: HTMLElement;
  search: string;
  signIn: (provider: Provider) => Promise<Tokens>;
  redirect: (url: string) => void;
  /** Waits before leaving the page, so a failure's message can be read. */
  pause?: () => Promise<void>;
};

const NAMES: Record<Provider, string> = { google: "Google", apple: "Apple" };
export const BLOCKED_MESSAGE = "Your browser blocked the sign-in window. Allow pop-ups for this page and click Continue again.";
const BACKED_OUT = ["auth/popup-closed-by-user", "auth/cancelled-popup-request"];

export function mountSignIn({ root, search, signIn, redirect, pause = () => new Promise((r) => setTimeout(r, 4000)) }: Deps): void {
  const params = new URLSearchParams(search);
  const provider = params.get("provider");
  const port = params.get("port") ?? "";
  const state = params.get("state") ?? "";
  const portNumber = Number(port);
  // Apple is not offered from the desktop app yet: see the nonce note in task-12-report.md.
  if (provider !== "google" || !/^\d+$/.test(port) || portNumber < 1024 || portNumber > 65535 || !/^[0-9a-f]{64}$/.test(state)) {
    root.textContent = "This sign-in link is not valid. Go back to Studium and try again.";
    return;
  }
  const back = new URL(`http://127.0.0.1:${portNumber}/callback`);
  back.searchParams.set("state", state);

  const message = document.createElement("p");
  message.textContent = "Sign in to Studium to link it with this computer.";
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = `Continue with ${NAMES[provider]}`;
  root.replaceChildren(message, button);

  const leave = (url: URL) => {
    message.textContent = "Going back to Studium…";
    redirect(url.toString());
  };
  button.addEventListener("click", async () => {
    button.disabled = true;
    message.textContent = "Signing in to Studium…";
    try {
      const t = await signIn(provider);
      if (!t.idToken) throw { code: "no-id-token" };
      back.searchParams.set("idToken", t.idToken);
      if (t.accessToken) back.searchParams.set("accessToken", t.accessToken);
      return leave(back);
    } catch (e) {
      const code = typeof e === "object" && e !== null ? String((e as { code?: unknown }).code ?? "") : "";
      if (code === "auth/popup-blocked") {
        message.textContent = BLOCKED_MESSAGE;
        button.disabled = false;
        return;
      }
      if (!BACKED_OUT.includes(code)) {
        message.textContent = `Sign-in failed (${code || "unknown error"}). Going back to Studium…`;
        await pause();
      }
    }
    back.searchParams.set("error", "cancelled");
    leave(back);
  });
}

/** The real sign-in. Firebase loads now, so the popup opens straight from the click. */
function firebaseSignIn(): (provider: Provider) => Promise<Tokens> {
  const ready = (async () => {
    if (FIREBASE_CONFIG === null) throw { code: "no-config" };
    const [{ initializeApp }, auth] = await Promise.all([import("firebase/app"), import("firebase/auth")]);
    // Nothing is kept in this browser: this page is on the same site as the hosted Studium app, so default
    // persistence would also sign the browser's Studium into the account and leave a refresh token behind.
    const a = auth.initializeAuth(initializeApp(FIREBASE_CONFIG), {
      persistence: auth.inMemoryPersistence,
      popupRedirectResolver: auth.browserPopupRedirectResolver,
    });
    return { a, auth };
  })();
  ready.catch(() => undefined);
  return async (provider) => {
    const { a, auth } = await ready;
    const p = provider === "google" ? new auth.GoogleAuthProvider() : new auth.OAuthProvider("apple.com");
    const result = await auth.signInWithPopup(a, p);
    const credential = provider === "google" ? auth.GoogleAuthProvider.credentialFromResult(result) : auth.OAuthProvider.credentialFromResult(result);
    return { idToken: credential?.idToken ?? "", accessToken: credential?.accessToken };
  };
}

const root = document.getElementById("message");
if (root) mountSignIn({ root, search: location.search, signIn: firebaseSignIn(), redirect: (url) => location.replace(url) });
