// Accounts for the React tree: who is signed in, the sync engine that keeps this device and the
// account in step, and the two dialogs (sign in, and the two-saves picker).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import SavePicker from "../components/SavePicker";
import SignInDialog, { type SignInMode } from "../components/SignInDialog";
import { useStudiumContext } from "../store/useStudium";
import { BACKUP_FAILED_MESSAGE, DELETE_NEEDS_SIGN_IN, authErrorMessage } from "../ui/format";
import type { Account, AuthClient } from "./auth";
import type { SyncedSettings } from "./records";
import type { RemoteStore } from "./remote";
import type { SaveSummary } from "./saveSummary";
import { createFirebaseServices } from "./services";
import { BACKUP_FAILED, NOT_APPLIED, createSyncEngine } from "./syncEngine";

export type SignInReason = "link" | "companion" | "purchase" | "collab";
type Summary = SaveSummary & { more: number };
export type Picker = { local: Summary; account: Summary };

export type AccountContext = {
  enabled: boolean;
  account: Account | null;
  lastSyncedAt: string | null;
  picker: Picker | null;
  /** A problem to show in Settings → Account (a failed connect, sign-out or delete). */
  error: string | null;
  openSignIn(reason?: SignInReason, mode?: SignInMode): void;
  choose(keep: "local" | "account"): Promise<void>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>;
};

const OFF: AccountContext = {
  enabled: false,
  account: null,
  lastSyncedAt: null,
  picker: null,
  error: null,
  openSignIn: () => {},
  choose: async () => {},
  signOut: async () => {},
  deleteAccount: async () => {},
};

const Ctx = createContext<AccountContext>(OFF);

/** Outside an AccountProvider, accounts are off. */
export function useAccount(): AccountContext {
  return useContext(Ctx);
}

const deviceLabel = () => (typeof window !== "undefined" && window.studiumDesktop?.desktop ? "Desktop app" : "Web browser");
const codeOf = (e: unknown) => (typeof e === "object" && e !== null ? (e as { code?: string }).code : undefined);

/** What to say when connecting or choosing failed. */
function syncFailure(e: unknown): string {
  const message = e instanceof Error ? e.message : "";
  return message === BACKUP_FAILED || message === NOT_APPLIED ? BACKUP_FAILED_MESSAGE : (authErrorMessage("network") as string);
}

type Props = { children: ReactNode; auth?: AuthClient | null; remote?: RemoteStore | null };

/** Defaults to the real Firebase; a build with no Firebase config (or `auth`/`remote` null) has accounts off. */
export function AccountProvider({ children, auth: authProp, remote: remoteProp }: Props) {
  const studium = useStudiumContext();
  const [services] = useState(() => {
    if (authProp !== undefined || remoteProp !== undefined) return authProp && remoteProp ? { auth: authProp, remote: remoteProp } : null;
    return createFirebaseServices();
  });

  // The engine reads and writes through these, so it always sees the latest data, even before React re-renders.
  const studiumRef = useRef(studium);
  studiumRef.current = studium;
  const [engine] = useState(() => {
    if (!services) return null;
    return createSyncEngine({
      remote: services.remote,
      storage: studium.storage,
      clock: studium.clock,
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
  });

  const [account, setAccount] = useState<Account | null>(() => services?.auth.current() ?? null);
  // The two-saves choice; `error` once a choice failed, shown until the person closes it.
  const [choice, setChoice] = useState<{ picker: Picker; error: string | null } | null>(null);
  const picker = choice?.picker ?? null;
  const [error, setError] = useState<string | null>(null);
  const [signIn, setSignIn] = useState<{ reason: SignInReason; mode: SignInMode } | null>(null);
  const [, setSyncedTick] = useState(0); // re-render when the engine's last sync time may have changed
  const connectedUid = useRef<string | null>(null);
  const connecting = useRef<Promise<string | null>>(Promise.resolve(null));

  /** Connects the engine to this account. Resolves with an error message (and signs out) if it failed. */
  const connect = useCallback(
    (uid: string): Promise<string | null> => {
      if (!engine || !services) return Promise.resolve(null);
      connectedUid.current = uid;
      setError(null);
      const run = engine.connect(uid).then(
        (r) => {
          if (r.kind === "picker") setChoice({ picker: { local: r.local, account: r.account }, error: null });
          setSyncedTick((n) => n + 1);
          return null;
        },
        async (e: unknown) => {
          const message = syncFailure(e);
          if (connectedUid.current === uid) connectedUid.current = null;
          setError(message);
          await services.auth.signOut().catch(() => undefined);
          return message;
        },
      );
      connecting.current = run;
      return run;
    },
    [engine, services],
  );

  useEffect(() => {
    if (!services || !engine) return;
    const onAccount = (a: Account | null) => {
      setAccount(a);
      if (a) {
        if (connectedUid.current !== a.uid) void connect(a.uid);
        return;
      }
      connectedUid.current = null;
      engine.stop();
      setChoice((c) => (c?.error ? c : null)); // a failed choice keeps its message showing until closed
    };
    const current = services.auth.current();
    if (current) onAccount(current);
    const unsubscribe = services.auth.onChange(onAccount);
    return () => {
      unsubscribe();
      engine.stop();
      connectedUid.current = null;
    };
  }, [services, engine, connect]);

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
        setSyncedTick((n) => n + 1);
      } catch (e) {
        const message = syncFailure(e);
        setChoice((c) => (c ? { ...c, error: message } : c));
        connectedUid.current = null;
        await services.auth.signOut().catch(() => undefined);
      }
    },
    [engine, services],
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

  const deleteAccount = useCallback(async () => {
    const uid = connectedUid.current ?? account?.uid;
    if (!engine || !services || !uid) return;
    setError(null);
    // Nothing more goes up while the account's data is being removed.
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
  }, [account, engine, services, connect]);

  /** After a sign-in in the dialog: waits for this device to connect; an error message if that failed. */
  const signedIn = useCallback(async (a: Account): Promise<string | null> => {
    // The auth listener has started connecting by now (or is connected already).
    if (connectedUid.current !== a.uid) return connect(a.uid);
    return connecting.current;
  }, [connect]);

  const openSignIn = useCallback((reason: SignInReason = "link", mode: SignInMode = "create") => setSignIn({ reason, mode }), []);
  const closeSignIn = useCallback(() => setSignIn(null), []);
  const closePicker = useCallback(() => setChoice(null), []);

  const lastSyncedAt = account && !choice ? (engine?.lastSyncedAt() ?? null) : null;
  const value = useMemo<AccountContext>(
    () =>
      services
        ? { enabled: true, account, lastSyncedAt, picker, error, openSignIn, choose, signOut, deleteAccount }
        : OFF,
    [services, account, lastSyncedAt, picker, error, openSignIn, choose, signOut, deleteAccount],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {services && signIn && (
        <SignInDialog auth={services.auth} reason={signIn.reason} initialMode={signIn.mode} onSignedIn={signedIn} onClose={closeSignIn} />
      )}
      {choice && <SavePicker {...choice.picker} error={choice.error} now={studium.now} onChoose={choose} onClose={closePicker} />}
    </Ctx.Provider>
  );
}
