// Accounts for the React tree: who is signed in, the sync engine that keeps this device and the
// account in step, and the two dialogs (sign in, and the two-saves picker).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import SavePicker from "../components/SavePicker";
import SignInDialog, { type SignInMode } from "../components/SignInDialog";
import { useStudiumContext } from "../store/useStudium";
import { BACKUP_FAILED_MESSAGE, DELETE_NEEDS_SIGN_IN, authErrorMessage } from "../ui/format";
import type { Account, AuthClient } from "./auth";
import { FIREBASE_CONFIG } from "./config";
import type { SyncedSettings } from "./records";
import type { RemoteStore } from "./remote";
import type { SaveSummary } from "./saveSummary";
import { createFirebaseServices, type Services } from "./services";
import { BACKUP_FAILED, NOT_APPLIED, SUPERSEDED, createSyncEngine } from "./syncEngine";

export type SignInReason = "link" | "companion" | "purchase" | "collab";
type Summary = SaveSummary & { more: number };
export type Picker = { local: Summary; account: Summary };

export type AccountContext = {
  enabled: boolean;
  /** Accounts are on but Firebase is still loading: entry points show, disabled. */
  loading: boolean;
  account: Account | null;
  lastSyncedAt: string | null;
  picker: Picker | null;
  /** The sign-in dialog is showing. */
  signInOpen: boolean;
  /** A problem to show in Settings → Account (a failed connect, sign-out or delete). */
  error: string | null;
  openSignIn(reason?: SignInReason, mode?: SignInMode): void;
  choose(keep: "local" | "account"): Promise<void>;
  /** "Not now": leaves the two-saves choice by signing out; nothing changes here or in the account. */
  dismissPicker(): Promise<void>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>;
};

const OFF: AccountContext = {
  enabled: false,
  loading: false,
  account: null,
  lastSyncedAt: null,
  picker: null,
  signInOpen: false,
  error: null,
  openSignIn: () => {},
  choose: async () => {},
  dismissPicker: async () => {},
  signOut: async () => {},
  deleteAccount: async () => {},
};

const Ctx = createContext<AccountContext>(OFF);

/** Outside an AccountProvider, accounts are off. */
export function useAccount(): AccountContext {
  return useContext(Ctx);
}

/** After a connect that couldn't reach the cloud, try again when back online, or after this long. */
export const RETRY_MS = 30_000;

const deviceLabel = () => (typeof window !== "undefined" && window.studiumDesktop?.desktop ? "Desktop app" : "Web browser");
const codeOf = (e: unknown) => (typeof e === "object" && e !== null ? (e as { code?: string }).code : undefined);
const NETWORK_MESSAGE = authErrorMessage("network") as string;

/** How a connect or choice failed: superseded (ignore), fatal (signed out: no backup, or data refused), or offline. */
function failureKind(e: unknown): "superseded" | "fatal" | "offline" {
  const message = e instanceof Error ? e.message : "";
  if (message === SUPERSEDED) return "superseded";
  return message === BACKUP_FAILED || message === NOT_APPLIED ? "fatal" : "offline";
}

type Props = {
  children: ReactNode;
  auth?: AuthClient | null;
  remote?: RemoteStore | null;
  /** Loads the services (for tests); defaults to the real Firebase, loaded lazily. */
  load?: () => Promise<Services | null>;
};
type Loaded = Services & { engine: ReturnType<typeof createSyncEngine> };

/**
 * Defaults to the real Firebase, loaded in its own chunk after the app starts. A build with no Firebase config
 * (or `auth`/`remote` null) has accounts off.
 */
export function AccountProvider({ children, auth: authProp, remote: remoteProp, load }: Props) {
  const studium = useStudiumContext();
  // The engine reads and writes through this, so it always sees the latest data, even before React re-renders.
  const studiumRef = useRef(studium);
  studiumRef.current = studium;

  function withEngine(s: Services): Loaded {
    const st = studiumRef.current;
    const engine = createSyncEngine({
      remote: s.remote,
      storage: st.storage,
      clock: st.clock,
      device: deviceLabel(),
      getLocal: () => {
        const { data, settings } = studiumRef.current.current();
        return { data, settings: { nickname: settings.nickname, petInvolvement: settings.petInvolvement, petOrder: settings.petOrder } };
      },
      applyLocal: (data, settings: SyncedSettings) => {
        if (!studiumRef.current.replaceData(data)) return false;
        studiumRef.current.updateSettings(settings);
        return true;
      },
    });
    return { ...s, engine };
  }

  const [status, setStatus] = useState<Loaded | null | "loading">(() => {
    if (authProp !== undefined || remoteProp !== undefined) return authProp && remoteProp ? withEngine({ auth: authProp, remote: remoteProp }) : null;
    return load || FIREBASE_CONFIG !== null ? "loading" : null;
  });
  const loading = status === "loading";
  const services = status === "loading" ? null : status;
  const engine = services?.engine ?? null;

  // Loads once, with the loader given at first render.
  const loadRef = useRef(load);
  useEffect(() => {
    if (!loading) return;
    let live = true;
    // The desktop app signs in through the system browser (its window can't run Google's popup).
    const browserSignIn = typeof window !== "undefined" ? window.studiumDesktop?.signInWithBrowser : undefined;
    (loadRef.current ?? (() => createFirebaseServices({ browserSignIn })))().then(
      (s) => {
        if (live) setStatus(s ? withEngine(s) : null);
      },
      () => {
        if (live) setStatus(null); // Firebase couldn't load (offline on a first visit): accounts stay off this time
      },
    );
    return () => {
      live = false;
    };
  }, [loading]);

  const [account, setAccount] = useState<Account | null>(null);
  // The two-saves choice; `error` once a choice failed, shown until the person closes it.
  const [choice, setChoice] = useState<{ picker: Picker; error: string | null } | null>(null);
  const picker = choice?.picker ?? null;
  const [error, setError] = useState<string | null>(null);
  const [signIn, setSignIn] = useState<{ reason: SignInReason; mode: SignInMode } | null>(null);
  const [, setSyncedTick] = useState(0); // re-render when the engine's last sync time may have changed
  const connectedUid = useRef<string | null>(null);
  const connecting = useRef<Promise<string | null>>(Promise.resolve(null));
  const cancelRetry = useRef<(() => void) | null>(null);
  // Set below; lets a retry call the latest connect.
  const connectRef = useRef<(uid: string) => Promise<string | null>>(async () => null);

  const stopRetrying = useCallback(() => {
    cancelRetry.current?.();
    cancelRetry.current = null;
  }, []);

  /** Tries `uid` again once back online, or after RETRY_MS, if still signed in as it. */
  const retryLater = useCallback(
    (uid: string) => {
      stopRetrying();
      const again = () => {
        stopRetrying();
        if (services?.auth.current()?.uid === uid && connectedUid.current === uid) void connectRef.current(uid);
      };
      window.addEventListener("online", again);
      const timer = setTimeout(again, RETRY_MS);
      cancelRetry.current = () => {
        window.removeEventListener("online", again);
        clearTimeout(timer);
      };
    },
    [services, stopRetrying],
  );

  /** Connects the engine to this account. Resolves with an error message if it failed and signed out. */
  const connect = useCallback(
    (uid: string): Promise<string | null> => {
      if (!engine || !services) return Promise.resolve(null);
      connectedUid.current = uid;
      stopRetrying();
      const run = engine.connect(uid).then(
        (r) => {
          // Connected: an earlier connect problem is over (other messages, like a delete's, stay).
          setError((m) => (m === NETWORK_MESSAGE || m === BACKUP_FAILED_MESSAGE ? null : m));
          if (r.kind === "picker") setChoice({ picker: { local: r.local, account: r.account }, error: null });
          setSyncedTick((n) => n + 1);
          return null;
        },
        async (e: unknown) => {
          const kind = failureKind(e);
          if (kind === "superseded") return null; // a newer connect, or a sign-out, took over
          if (kind === "offline") {
            // Still signed in: edits keep being kept here, and go up once connected.
            setError(NETWORK_MESSAGE);
            retryLater(uid);
            return null;
          }
          if (connectedUid.current === uid) connectedUid.current = null;
          setError(BACKUP_FAILED_MESSAGE);
          await services.auth.signOut().catch(() => undefined);
          return BACKUP_FAILED_MESSAGE;
        },
      );
      connecting.current = run;
      return run;
    },
    [engine, services, stopRetrying, retryLater],
  );
  connectRef.current = connect;

  useEffect(() => {
    if (!services || !engine) return;
    const onAccount = (a: Account | null) => {
      setAccount(a);
      if (a) {
        if (connectedUid.current !== a.uid) void connect(a.uid);
        return;
      }
      stopRetrying();
      connectedUid.current = null;
      engine.stop();
      setChoice((c) => (c?.error ? c : null)); // a failed choice keeps its message showing until closed
    };
    // Signed in already (a test, or a session restored before this ran); otherwise the listener reports it.
    const current = services.auth.current();
    if (current) onAccount(current);
    const unsubscribe = services.auth.onChange(onAccount);
    return () => {
      unsubscribe();
      stopRetrying();
      engine.stop();
      connectedUid.current = null;
    };
  }, [services, engine, connect, stopRetrying]);

  // Local edits go up to the account (the engine ignores ones it made itself).
  const { nickname, petInvolvement, petOrder } = studium.settings;
  useEffect(() => {
    engine?.localChanged();
  }, [engine, studium.data, nickname, petInvolvement, petOrder]);

  const choose = useCallback(
    async (keep: "local" | "account") => {
      const uid = connectedUid.current;
      if (!engine || !services || !uid) return;
      try {
        await engine.choose(uid, keep);
        setChoice(null);
        setError(null);
        setSyncedTick((n) => n + 1);
      } catch (e) {
        const kind = failureKind(e);
        if (kind === "superseded") return; // signed out ("Not now") while it ran
        if (kind === "offline") {
          // Still signed in; connecting again once back online offers the choice again if it's still needed.
          setChoice(null);
          setError(NETWORK_MESSAGE);
          retryLater(uid);
          return;
        }
        setChoice((c) => (c ? { ...c, error: BACKUP_FAILED_MESSAGE } : c));
        connectedUid.current = null;
        await services.auth.signOut().catch(() => undefined);
      }
    },
    [engine, services, retryLater],
  );

  const signOut = useCallback(async () => {
    if (!services) return;
    setError(null);
    try {
      await services.auth.signOut();
    } catch (e) {
      setError(authErrorMessage(codeOf(e)));
    }
  }, [services]);

  const dismissPicker = useCallback(async () => {
    if (!services) return;
    try {
      await services.auth.signOut(); // the auth listener stops the engine and closes the picker
    } catch (e) {
      setChoice(null);
      setError(authErrorMessage(codeOf(e)));
    }
  }, [services]);

  const deleteAccount = useCallback(async () => {
    const uid = connectedUid.current ?? account?.uid;
    if (!engine || !services || !uid) return;
    setError(null);
    // Nothing more goes up while the account's data is being removed.
    stopRetrying();
    engine.stop();
    connectedUid.current = null;
    try {
      await services.remote.deleteAll(uid);
      await services.auth.deleteAccount();
      engine.forget();
    } catch (e) {
      const code = codeOf(e);
      // Still signed in: carry on syncing, which puts the data back until the delete goes through.
      if (services.auth.current()?.uid === uid) void connect(uid);
      if (code === "needs-recent-sign-in") {
        setError(DELETE_NEEDS_SIGN_IN);
        setSignIn({ reason: "link", mode: "signin" });
      } else {
        setError(authErrorMessage(code) ?? authErrorMessage("other"));
      }
    }
  }, [account, engine, services, connect, stopRetrying]);

  /** After a sign-in in the dialog: waits for this device to connect; an error message if that failed. */
  const signedIn = useCallback(
    async (a: Account): Promise<string | null> => {
      // The auth listener has started connecting by now (or is connected already).
      if (connectedUid.current !== a.uid) return connect(a.uid);
      return connecting.current;
    },
    [connect],
  );

  const openSignIn = useCallback((reason: SignInReason = "link", mode: SignInMode = "create") => setSignIn({ reason, mode }), []);
  const closeSignIn = useCallback(() => setSignIn(null), []);
  const closePicker = useCallback(() => setChoice(null), []);

  const lastSyncedAt = account && !choice ? (engine?.lastSyncedAt() ?? null) : null;
  const value = useMemo<AccountContext>(
    () =>
      loading
        ? { ...OFF, enabled: true, loading: true }
        : services
          ? { enabled: true, loading: false, account, lastSyncedAt, picker, signInOpen: signIn !== null, error, openSignIn, choose, dismissPicker, signOut, deleteAccount }
          : OFF,
    [loading, services, account, lastSyncedAt, picker, signIn, error, openSignIn, choose, dismissPicker, signOut, deleteAccount],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {services && signIn && (
        <SignInDialog auth={services.auth} reason={signIn.reason} initialMode={signIn.mode} onSignedIn={signedIn} onClose={closeSignIn} />
      )}
      {choice && (
        <SavePicker
          {...choice.picker}
          error={choice.error}
          now={studium.now}
          onChoose={choose}
          onNotNow={dismissPicker}
          onClose={closePicker}
        />
      )}
    </Ctx.Provider>
  );
}
