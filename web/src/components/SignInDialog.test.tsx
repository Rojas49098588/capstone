// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NOW } from "../planner/testData";
import { buildSeed } from "../store/seed";
import { SYNC_KEY } from "../sync/syncState";
import { AskToSignIn, ProjectNames, renderWithAccount, storageWithoutBackups, submitSignIn } from "../test/account";
import Settings from "./Settings";

const BONUS = "Link an account to save your progress and get a bonus later.";

describe("SignInDialog", () => {
  it("wrong password shows 'That password isn't right.' and stays open", async () => {
    const user = userEvent.setup();
    const { auth } = renderWithAccount(<Settings />);
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    auth.fail("signInEmail", "wrong-password");
    await submitSignIn(user, "abby@example.com", "nope");
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText("That password isn't right.");
    expect(auth.current()).toBeNull();
    screen.getByRole("button", { name: "Link account" });
  });

  it("Forgot password sends the reset email and says so", async () => {
    const user = userEvent.setup();
    const { auth } = renderWithAccount(<Settings />);
    const reset = vi.spyOn(auth, "resetPassword");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Forgot password?" }));
    within(dialog).getByText("Enter your email first.");
    expect(reset).not.toHaveBeenCalled();
    await user.type(within(dialog).getByLabelText("Email"), "abby@example.com");
    await user.click(within(dialog).getByRole("button", { name: "Forgot password?" }));
    await within(dialog).findByText("Check your email for a reset link.");
    expect(reset).toHaveBeenCalledWith("abby@example.com");
  });

  it("has Sign in and Create account, Google and Apple, and Escape closes it", async () => {
    const user = userEvent.setup();
    const { auth } = renderWithAccount(<Settings />);
    await user.click(screen.getByRole("button", { name: "Link account" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("tab", { name: "Create account" }).getAttribute("aria-selected")).toBe("true");
    within(dialog).getByText(BONUS);
    auth.fail("createEmail", "weak-password");
    await submitSignIn(user, "abby@example.com", "123", "Create account");
    await within(dialog).findByText("Use at least 6 characters.");
    within(dialog).getByRole("button", { name: "Continue with Apple" });
    auth.fail("signInGoogle", "cancelled");
    await user.click(within(dialog).getByRole("button", { name: "Continue with Google" }));
    expect(within(dialog).queryByRole("alert")).toBeNull(); // backing out of Google says nothing
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Continue with Google links the account", async () => {
    const user = userEvent.setup();
    renderWithAccount(<Settings />);
    await user.click(screen.getByRole("button", { name: "Link account" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Continue with Google" }));
    await screen.findByText("Last synced just now");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Continue with Apple signs in", async () => {
    const user = userEvent.setup();
    const { auth } = renderWithAccount(<Settings />);
    await user.click(screen.getByRole("button", { name: "Link account" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Continue with Apple" }));
    await screen.findByText("Last synced just now");
    expect(auth.current()).not.toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("the desktop app does not offer Apple (its browser hand-off has no verified nonce)", async () => {
    window.studiumDesktop = { desktop: true };
    try {
      const user = userEvent.setup();
      renderWithAccount(<Settings />);
      await user.click(screen.getByRole("button", { name: "Link account" }));
      const dialog = screen.getByRole("dialog");
      within(dialog).getByRole("button", { name: "Continue with Google" });
      expect(within(dialog).queryByRole("button", { name: "Continue with Apple" })).toBeNull();
    } finally {
      delete window.studiumDesktop;
    }
  });

  it("says why it is asking, and always mentions the bonus", async () => {
    const user = userEvent.setup();
    renderWithAccount(<AskToSignIn reason="purchase" />);
    await user.click(screen.getByRole("button", { name: "Ask" }));
    const dialog = screen.getByRole("dialog");
    within(dialog).getByText("Sign in so your purchases are saved to your account.");
    within(dialog).getByText(BONUS);
  });

  it("if a backup can't be written, says so and leaves the device signed out with its data", async () => {
    const user = userEvent.setup();
    const storage = storageWithoutBackups();
    // This device's data came from another account, so signing in must back it up first.
    storage.setItem(SYNC_KEY, JSON.stringify({ uid: null, owner: "u-other", stamps: {}, hashes: {}, tombstones: {}, changedWhileSignedOut: false }));
    const { auth } = renderWithAccount(
      <>
        <Settings />
        <ProjectNames />
      </>,
      { storage },
    );
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await submitSignIn(user, "abby@example.com", "secret1");
    const dialog = screen.getByRole("dialog");
    await within(dialog).findByText("Studium couldn't save a backup on this computer, so nothing was changed.");
    expect(auth.current()).toBeNull();
    expect(within(screen.getByRole("list", { name: "Projects" })).getAllByRole("listitem")).toHaveLength(buildSeed(NOW).projects.length);
  });
});
