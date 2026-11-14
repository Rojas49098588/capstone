// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { BLOCKED_MESSAGE, mountSignIn } from "./desktopSignIn";

const STATE = "a".repeat(64);
const valid = `?provider=google&port=51234&state=${STATE}`;

function setup(search: string, signIn = vi.fn(async () => ({ idToken: "ID", accessToken: "AT" }))) {
  const root = document.createElement("div");
  const redirect = vi.fn();
  mountSignIn({ root, search, signIn, redirect, pause: async () => {} });
  return { root, signIn, redirect, button: root.querySelector("button") };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("desktop sign-in page", () => {
  it("waits for a click before opening the popup, then sends the tokens back", async () => {
    const { signIn, redirect, button } = setup(valid);
    expect(button?.textContent).toBe("Continue with Google");
    expect(signIn).not.toHaveBeenCalled();
    button?.click();
    await flush();
    expect(signIn).toHaveBeenCalledWith("google");
    expect(redirect).toHaveBeenCalledWith(`http://127.0.0.1:51234/callback?state=${STATE}&idToken=ID&accessToken=AT`);
  });

  it.each([
    ["?provider=google&port=80&state=" + STATE],
    ["?provider=google&port=99999&state=" + STATE],
    ["?provider=google&port=51234&state=zz"],
    ["?provider=apple&port=51234&state=" + STATE],
    ["?provider=github&port=51234&state=" + STATE],
  ])("shows an error and no button for an invalid link %s", (search) => {
    const { root, signIn, button } = setup(search);
    expect(button).toBeNull();
    expect(root.textContent).toContain("not valid");
    expect(signIn).not.toHaveBeenCalled();
  });

  it("a blocked popup says so, does not redirect, and can be retried", async () => {
    const signIn = vi.fn().mockRejectedValueOnce({ code: "auth/popup-blocked" }).mockResolvedValueOnce({ idToken: "ID" });
    const { root, redirect, button } = setup(valid, signIn);
    button?.click();
    await flush();
    expect(root.textContent).toContain(BLOCKED_MESSAGE);
    expect(redirect).not.toHaveBeenCalled();
    expect(button?.disabled).toBe(false);
    button?.click();
    await flush();
    expect(redirect).toHaveBeenCalledWith(expect.stringContaining("idToken=ID"));
  });

  it("closing the popup goes back as cancelled", async () => {
    const { redirect, button } = setup(valid, vi.fn().mockRejectedValue({ code: "auth/popup-closed-by-user" }));
    button?.click();
    await flush();
    expect(redirect).toHaveBeenCalledWith(expect.stringContaining("error=cancelled"));
  });

  it("another failure shows its code, then goes back as cancelled", async () => {
    const root = document.createElement("div");
    const redirect = vi.fn();
    let shown = "";
    const pause = async () => {
      shown = root.textContent ?? "";
    };
    mountSignIn({ root, search: valid, signIn: vi.fn().mockRejectedValue({ code: "auth/network-request-failed" }), redirect, pause });
    root.querySelector("button")?.click();
    await flush();
    expect(shown).toContain("auth/network-request-failed");
    expect(redirect).toHaveBeenCalledWith(expect.stringContaining("error=cancelled"));
  });
});
