import { describe, expect, it, vi } from "vitest";
import { FakeAuth } from "./fakeAuth";

describe("FakeAuth", () => {
  it("starts signed out and signs in with a deterministic account", async () => {
    const auth = new FakeAuth();
    const seen = vi.fn();
    auth.onChange(seen);
    expect(auth.current()).toBeNull();
    const a = await auth.signInEmail("a@b.c", "pw");
    expect(a.uid).toBe("u-a@b.c");
    expect(auth.current()).toEqual(a);
    expect(seen).toHaveBeenCalledWith(a);
    expect((await new FakeAuth().signInGoogle()).uid).toBe("u-google");
  });

  it("fail() rejects only the next call, with { code }", async () => {
    const auth = new FakeAuth();
    auth.fail("signInEmail", "wrong-password");
    await expect(auth.signInEmail("a@b.c", "x")).rejects.toEqual({ code: "wrong-password" });
    await expect(auth.signInEmail("a@b.c", "x")).resolves.toBeTruthy();
  });

  it("rejects creating an email that is already used", async () => {
    const auth = new FakeAuth();
    await auth.createEmail("a@b.c", "pw");
    await expect(auth.createEmail("a@b.c", "pw")).rejects.toEqual({ code: "email-in-use" });
  });

  it("signs out on deleteAccount and notifies, and unsubscribe stops it", async () => {
    const auth = new FakeAuth();
    const seen = vi.fn();
    const off = auth.onChange(seen);
    auth.signInAs({ uid: "u1", email: null, createdAt: "2026-01-01T00:00:00.000Z" });
    await auth.deleteAccount();
    expect(auth.current()).toBeNull();
    expect(seen).toHaveBeenLastCalledWith(null);
    off();
    auth.signInAs({ uid: "u2", email: null, createdAt: "2026-01-01T00:00:00.000Z" });
    expect(seen).toHaveBeenCalledTimes(2);
  });
});
