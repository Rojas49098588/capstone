// The page the desktop app opens in the person's browser to sign in (desktop/src/main/browserSignIn.js).
// It signs in with a popup, then hands the tokens to the desktop app's local server.
import { FIREBASE_CONFIG } from "./sync/config";

const message = document.getElementById("message") as HTMLElement;
const params = new URLSearchParams(location.search);
const provider = params.get("provider");
const port = params.get("port") ?? "";
const state = params.get("state") ?? "";

function fail(text: string): void {
  message.textContent = text;
}

async function run(): Promise<void> {
  const portNumber = Number(port);
  if ((provider !== "google" && provider !== "apple") || !/^\d+$/.test(port) || portNumber < 1024 || portNumber > 65535 || !/^[0-9a-f]{64}$/.test(state)) {
    return fail("This sign-in link is not valid. Go back to Studium and try again.");
  }
  if (FIREBASE_CONFIG === null) return fail("Sign-in is not available in this build.");
  const back = new URL(`http://127.0.0.1:${portNumber}/callback`);
  back.searchParams.set("state", state);
  try {
    const [{ initializeApp }, auth] = await Promise.all([import("firebase/app"), import("firebase/auth")]);
    const a = auth.getAuth(initializeApp(FIREBASE_CONFIG));
    const p = provider === "google" ? new auth.GoogleAuthProvider() : new auth.OAuthProvider("apple.com");
    const result = await auth.signInWithPopup(a, p);
    const credential = provider === "google" ? auth.GoogleAuthProvider.credentialFromResult(result) : auth.OAuthProvider.credentialFromResult(result);
    if (!credential?.idToken) throw new Error("no id token");
    back.searchParams.set("idToken", credential.idToken);
    if (credential.accessToken) back.searchParams.set("accessToken", credential.accessToken);
  } catch {
    back.searchParams.set("error", "cancelled");
  }
  message.textContent = "Going back to Studium…";
  location.replace(back.toString());
}

void run();
