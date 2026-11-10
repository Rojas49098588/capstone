import { useEffect, useState, type FormEvent } from "react";
import type { Account, AuthClient } from "../sync/auth";
import type { SignInReason } from "../sync/AccountProvider";
import {
  ACCOUNT_BONUS_LINE,
  APPLE_SIGN_IN_LABEL,
  CREATE_ACCOUNT_LABEL,
  FORGOT_PASSWORD_LABEL,
  GOOGLE_SIGN_IN_LABEL,
  RESET_NEEDS_EMAIL,
  RESET_SENT,
  SIGN_IN_LABEL,
  SIGN_IN_REASONS,
  SIGN_IN_TITLE,
  authErrorMessage,
} from "../ui/format";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, CARD, INPUT, LABEL, MUTED, SERIF } from "../ui/styles";
import { useReturnFocus } from "./useReturnFocus";

export type SignInMode = "signin" | "create";

type Props = {
  auth: AuthClient;
  reason: SignInReason;
  initialMode: SignInMode;
  /** Called once signed in; resolves with an error message if this device couldn't connect to the account. */
  onSignedIn: (a: Account) => Promise<string | null>;
  onClose: () => void;
};

const MODES: { mode: SignInMode; label: string }[] = [
  { mode: "signin", label: SIGN_IN_LABEL },
  { mode: "create", label: CREATE_ACCOUNT_LABEL },
];
const codeOf = (e: unknown) => (typeof e === "object" && e !== null ? (e as { code?: string }).code : undefined);

/** The sign-in box: email and password (signing in or creating an account), Google and Apple. */
export default function SignInDialog({ auth, reason, initialMode, onSignedIn, onClose }: Props) {
  useReturnFocus();
  const [mode, setMode] = useState<SignInMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const why = SIGN_IN_REASONS[reason];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function run(signIn: () => Promise<Account>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const failed = await onSignedIn(await signIn());
      if (failed === null) {
        onClose();
        return;
      }
      setError(failed);
    } catch (e) {
      setError(authErrorMessage(codeOf(e)));
    }
    setBusy(false);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const address = email.trim();
    void run(() => (mode === "signin" ? auth.signInEmail(address, password) : auth.createEmail(address, password)));
  }

  async function forgot() {
    setError(null);
    setNotice(null);
    const address = email.trim();
    if (!address) {
      setError(RESET_NEEDS_EMAIL);
      return;
    }
    setBusy(true);
    try {
      await auth.resetPassword(address);
      setNotice(RESET_SENT);
    } catch (e) {
      setError(authErrorMessage(codeOf(e)));
    }
    setBusy(false);
  }

  const label = MODES.find((m) => m.mode === mode)?.label as string;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)]">
      <div role="dialog" aria-modal="true" aria-labelledby="sign-in-title" className={`${CARD} w-full max-w-md mx-4 p-6 space-y-4`}>
        <h2 id="sign-in-title" style={SERIF} className="text-xl">
          {SIGN_IN_TITLE}
        </h2>
        {why && <p className="text-sm">{why}</p>}
        <p className={`text-sm ${MUTED}`}>{ACCOUNT_BONUS_LINE}</p>

        <div role="tablist" aria-label="Sign in or create an account" className="flex gap-1">
          {MODES.map((m) => (
            <button
              key={m.mode}
              type="button"
              role="tab"
              aria-selected={mode === m.mode}
              onClick={() => {
                setMode(m.mode);
                setError(null);
                setNotice(null);
              }}
              className={`px-3 py-1.5 text-sm transition-colors ${
                mode === m.mode
                  ? "bg-[var(--color-inverse)] text-[var(--color-inverse-foreground)]"
                  : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label htmlFor="sign-in-email" className={LABEL}>
              Email
            </label>
            <input
              id="sign-in-email"
              type="email"
              autoComplete="email"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={INPUT}
            />
          </div>
          <div>
            <label htmlFor="sign-in-password" className={LABEL}>
              Password
            </label>
            <input
              id="sign-in-password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={INPUT}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-[var(--color-accent)]">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="text-sm">
              {notice}
            </p>
          )}
          <div className="flex items-center justify-between gap-2">
            {mode === "signin" ? (
              <button type="button" onClick={() => void forgot()} disabled={busy} className={`text-sm underline ${MUTED} hover:text-[var(--color-foreground)]`}>
                {FORGOT_PASSWORD_LABEL}
              </button>
            ) : (
              <span />
            )}
            <button type="submit" disabled={busy} className={BUTTON_PRIMARY}>
              {label}
            </button>
          </div>
        </form>

        <div className="space-y-2 pt-2 border-t border-[var(--color-border)]">
          <button type="button" disabled={busy} onClick={() => void run(() => auth.signInGoogle())} className={`${BUTTON_SECONDARY} w-full`}>
            {GOOGLE_SIGN_IN_LABEL}
          </button>
          <button type="button" disabled={busy} onClick={() => void run(() => auth.signInApple())} className={`${BUTTON_SECONDARY} w-full`}>
            {APPLE_SIGN_IN_LABEL}
          </button>
        </div>

        <div className="flex justify-end">
          <button type="button" onClick={onClose} className={BUTTON_SECONDARY}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
