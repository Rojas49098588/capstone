// An in-memory AuthClient for tests. Starts signed out.
import type { Account, AuthClient, AuthError } from "../sync/auth";

type Method = Exclude<keyof AuthClient, "current" | "onChange">;

export class FakeAuth implements AuthClient {
  private account: Account | null = null;
  private listeners = new Set<(a: Account | null) => void>();
  private failures = new Map<Method, AuthError>();
  private emails = new Set<string>();

  private set(a: Account | null): void {
    this.account = a;
    for (const cb of [...this.listeners]) cb(a);
  }

  /** Makes the next call of this method reject with { code: error }. */
  fail(method: Method, error: AuthError): void {
    this.failures.set(method, error);
  }

  private check(method: Method): void {
    const code = this.failures.get(method);
    if (code === undefined) return;
    this.failures.delete(method);
    throw { code };
  }

  private accountFor(id: string, email: string | null): Account {
    return { uid: `u-${id}`, email, createdAt: new Date(0).toISOString() };
  }

  signInAs(account: Account): void {
    this.set(account);
  }

  current(): Account | null {
    return this.account;
  }

  onChange(cb: (a: Account | null) => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  async signInEmail(email: string, _password: string): Promise<Account> {
    this.check("signInEmail");
    const a = this.accountFor(email, email);
    this.set(a);
    return a;
  }

  async createEmail(email: string, _password: string): Promise<Account> {
    this.check("createEmail");
    if (this.emails.has(email)) throw { code: "email-in-use" satisfies AuthError };
    this.emails.add(email);
    const a = this.accountFor(email, email);
    this.set(a);
    return a;
  }

  async resetPassword(_email: string): Promise<void> {
    this.check("resetPassword");
  }

  async signInGoogle(): Promise<Account> {
    this.check("signInGoogle");
    const a = this.accountFor("google", null);
    this.set(a);
    return a;
  }

  async signInApple(): Promise<Account> {
    this.check("signInApple");
    const a = this.accountFor("apple", null);
    this.set(a);
    return a;
  }

  async signOut(): Promise<void> {
    this.check("signOut");
    this.set(null);
  }

  async deleteAccount(): Promise<void> {
    this.check("deleteAccount");
    this.set(null);
  }
}
