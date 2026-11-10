// Test helpers for the account screens: a FakeAuth and FakeRemote behind an AccountProvider.
import { screen, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import type { ReactElement } from "react";
import { NOW } from "../planner/testData";
import type { StudiumData } from "../planner/types";
import { BACKUP_PREFIX } from "../store/storage";
import { useStudiumContext } from "../store/useStudium";
import { AccountProvider, useAccount } from "../sync/AccountProvider";
import type { Account } from "../sync/auth";
import type { SyncedSettings } from "../sync/records";
import { createSyncEngine } from "../sync/syncEngine";
import { FakeAuth } from "./fakeAuth";
import { FakeRemote } from "./fakeRemote";
import { memoryStorage, renderWithStudium } from "./render";

export const ABBY: Account = { uid: "u1", email: "abby@example.com", createdAt: NOW.toISOString() };
const BEE: SyncedSettings = { nickname: "Bee", petInvolvement: "moderate", petOrder: "dueDate" };
/** When the other device last saved the account: two days before NOW. */
export const ACCOUNT_SAVED_AT = new Date(NOW.getTime() - 2 * 86_400_000);

/** Renders `ui` with Studium and accounts. `auth: null` and `remote: null` turn accounts off. */
export function renderWithAccount(
  ui: ReactElement,
  o: { data?: StudiumData; storage?: Storage; auth?: FakeAuth | null; remote?: FakeRemote | null; signedIn?: Account } = {},
) {
  const auth = o.auth === undefined ? new FakeAuth() : o.auth;
  const remote = o.remote === undefined ? new FakeRemote() : o.remote;
  if (o.signedIn && auth) auth.signInAs(o.signedIn);
  const result = renderWithStudium(
    <AccountProvider auth={auth} remote={remote}>
      {ui}
    </AccountProvider>,
    { data: o.data, storage: o.storage },
  );
  return { ...result, auth: auth as FakeAuth, remote: remote as FakeRemote, storage: result.storage as Storage };
}

/** Another device ("Desktop app") linked `uid` with `data`. */
export async function accountHas(remote: FakeRemote, uid: string, data: StudiumData): Promise<void> {
  const engine = createSyncEngine({
    remote,
    storage: memoryStorage(),
    clock: () => ACCOUNT_SAVED_AT,
    device: "Desktop app",
    getLocal: () => ({ data, settings: BEE }),
    applyLocal: () => true,
  });
  await engine.connect(uid);
  engine.stop();
}

/** Storage that can't take backups (full), but saves everything else. */
export function storageWithoutBackups(): Storage {
  const s = memoryStorage();
  const setItem = s.setItem.bind(s);
  s.setItem = (k: string, v: string) => {
    if (k.startsWith(BACKUP_PREFIX)) throw new Error("QuotaExceededError");
    setItem(k, v);
  };
  return s;
}

export function backupKeys(storage: Storage): string[] {
  const out: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i) as string;
    if (k.startsWith(BACKUP_PREFIX)) out.push(k);
  }
  return out;
}

/** The project names on screen, as any page would show them. */
export function ProjectNames() {
  const s = useStudiumContext();
  return (
    <ul aria-label="Projects">
      {s.data.projects.map((p) => (
        <li key={p.id}>{p.name}</li>
      ))}
    </ul>
  );
}

/** A button that asks to sign in for a reason, as the Shop or the companion app will. */
export function AskToSignIn({ reason }: { reason: "link" | "companion" | "purchase" | "collab" }) {
  const a = useAccount();
  return (
    <button type="button" onClick={() => a.openSignIn(reason)}>
      Ask
    </button>
  );
}

/** Fills the open sign-in dialog and presses its submit button. */
export async function submitSignIn(user: UserEvent, email: string, password: string, submit = "Sign in"): Promise<void> {
  const dialog = screen.getByRole("dialog");
  await user.type(within(dialog).getByLabelText("Email"), email);
  await user.type(within(dialog).getByLabelText("Password"), password);
  await user.click(within(dialog).getByRole("button", { name: submit }));
}
