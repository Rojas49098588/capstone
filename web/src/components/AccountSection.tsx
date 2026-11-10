import { useState } from "react";
import { BACKUP_PREFIX } from "../store/storage";
import { useStudiumContext } from "../store/useStudium";
import { useAccount } from "../sync/AccountProvider";
import {
  ACCOUNT_BONUS_LINE,
  ACCOUNT_LINK_LABEL,
  ACCOUNTS_OFF_TEXT,
  BACKUP_DOWNLOAD_LABEL,
  BACKUPS_HEADING,
  DELETE_ACCOUNT_CONFIRM,
  DELETE_ACCOUNT_LABEL,
  SIGN_IN_LABEL,
  SIGN_OUT_LABEL,
  SIGNED_IN_WITHOUT_EMAIL,
  backupFileName,
  backupLabel,
  lastSyncedLabel,
} from "../ui/format";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, BUTTON_SMALL, LABEL, MUTED } from "../ui/styles";

/** Backups of replaced data on this device, newest first. */
function backupKeys(storage: Storage | null): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < (storage?.length ?? 0); i++) {
      const k = storage?.key(i);
      if (k?.startsWith(BACKUP_PREFIX)) keys.push(k);
    }
  } catch {
    return []; // storage blocked
  }
  return keys.sort().reverse();
}

function download(storage: Storage | null, key: string): void {
  const raw = storage?.getItem(key);
  if (!raw) return;
  const url = URL.createObjectURL(new Blob([raw], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = backupFileName(key);
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Settings → Account: link or sign in as a guest; once signed in, the email, last sync, sign out and delete. */
export default function AccountSection() {
  const a = useAccount();
  const s = useStudiumContext();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!a.enabled) {
    return (
      <>
        <p className={`text-sm ${MUTED}`}>{ACCOUNTS_OFF_TEXT}</p>
        <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
          <dt className={LABEL}>Email</dt>
          <dd className={MUTED}>Not set yet</dd>
        </dl>
      </>
    );
  }

  async function act(work: () => Promise<void>) {
    setBusy(true);
    await work();
    setBusy(false);
  }

  const backups = backupKeys(s.storage);

  return (
    <>
      {a.account ? (
        <>
          <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
            <dt className={LABEL}>Email</dt>
            <dd>{a.account.email ?? SIGNED_IN_WITHOUT_EMAIL}</dd>
          </dl>
          <p className={`text-sm ${MUTED}`}>{lastSyncedLabel(a.lastSyncedAt, s.now)}</p>
          {confirmDelete ? (
            <div className="space-y-2">
              <p className="text-sm">{DELETE_ACCOUNT_CONFIRM}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  className={BUTTON_PRIMARY}
                  onClick={() =>
                    void act(async () => {
                      setConfirmDelete(false);
                      await a.deleteAccount();
                    })
                  }
                >
                  {DELETE_ACCOUNT_LABEL}
                </button>
                <button type="button" className={BUTTON_SECONDARY} onClick={() => setConfirmDelete(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy} className={BUTTON_SECONDARY} onClick={() => void act(a.signOut)}>
                {SIGN_OUT_LABEL}
              </button>
              <button type="button" disabled={busy} className={BUTTON_SECONDARY} onClick={() => setConfirmDelete(true)}>
                {DELETE_ACCOUNT_LABEL}
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <p className={`text-sm ${MUTED}`}>{ACCOUNT_BONUS_LINE}</p>
          <div className="flex flex-wrap gap-2">
            {/* While Firebase loads, the buttons show but wait. */}
            <button type="button" disabled={a.loading} className={BUTTON_PRIMARY} onClick={() => a.openSignIn("link", "create")}>
              {ACCOUNT_LINK_LABEL}
            </button>
            <button type="button" disabled={a.loading} className={`${BUTTON_SECONDARY} disabled:opacity-50`} onClick={() => a.openSignIn("link", "signin")}>
              {SIGN_IN_LABEL}
            </button>
          </div>
        </>
      )}
      {a.error && (
        <p role="alert" className="text-sm text-[var(--color-accent)]">
          {a.error}
        </p>
      )}
      {backups.length > 0 && (
        <div>
          <p className={LABEL}>{BACKUPS_HEADING}</p>
          <ul className="text-sm space-y-1 mt-1">
            {backups.map((key) => (
              <li key={key} className="flex items-center gap-3">
                <span>{backupLabel(key)}</span>
                <button type="button" className={BUTTON_SMALL} onClick={() => download(s.storage, key)}>
                  {BACKUP_DOWNLOAD_LABEL}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
