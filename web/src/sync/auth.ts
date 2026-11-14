// What Studium needs from sign-in; the real one is in firebase, tests use a fake.
export type Account = { uid: string; email: string | null; createdAt: string };
export type AuthError =
  | "wrong-password"
  | "no-account"
  | "email-in-use"
  | "weak-password"
  | "network"
  | "needs-recent-sign-in"
  | "cancelled"
  | "other";

export interface AuthClient {
  current(): Account | null;
  onChange(cb: (a: Account | null) => void): () => void;
  signInEmail(email: string, password: string): Promise<Account>;
  createEmail(email: string, password: string): Promise<Account>;
  resetPassword(email: string): Promise<void>;
  signInGoogle(): Promise<Account>;
  signInApple(): Promise<Account>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>;
}
