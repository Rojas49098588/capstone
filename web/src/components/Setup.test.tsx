// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NOW } from "../planner/testData";
import { buildSeed, emptyData } from "../store/seed";
import { SETTINGS_KEY } from "../store/settings";
import { accountHas, renderWithAccount, submitSignIn } from "../test/account";
import { FakeRemote } from "../test/fakeRemote";
import { renderWithStudium, withEgg } from "../test/render";
import Setup from "./Setup";

const stored = (storage: Storage | null) => JSON.parse(storage?.getItem(SETTINGS_KEY) as string);
const radio = (name: string) => screen.getByRole("radio", { name }) as HTMLInputElement;
const next = () => userEvent.click(screen.getByRole("button", { name: "Continue" }));

function renderSetup(settings: Record<string, unknown> = {}) {
  const onTheme = vi.fn();
  const onFinish = vi.fn();
  const r = renderWithStudium(<Setup theme="light" onTheme={onTheme} onFinish={onFinish} />, { settings: { setupDone: false, ...settings } });
  return { ...r, onTheme, onFinish };
}

describe("Setup", () => {
  it("walks through 3 steps and saves every answer at the end", async () => {
    const { storage, onFinish } = renderSetup();
    screen.getByText("Step 1 of 3");
    await userEvent.type(screen.getByRole("textbox", { name: "Nickname" }), "Abby");
    await next();
    screen.getByText("Step 2 of 3");
    await userEvent.click(radio("Moderate"));
    await next();
    screen.getByText("Step 3 of 3");
    await userEvent.click(radio("Bars"));
    await userEvent.click(radio("Dark"));
    await userEvent.click(screen.getByRole("button", { name: "Start using Studium" }));
    expect(stored(storage)).toMatchObject({ nickname: "Abby", petInvolvement: "moderate", progressStyle: "bar", setupDone: true });
    expect(onFinish).toHaveBeenCalled();
  });

  it("doesn't ask for a project type or difficulty: each new project picks its own", async () => {
    renderSetup();
    for (let i = 0; i < 3; i++) {
      expect(screen.queryByRole("radio", { name: "School" })).toBeNull();
      expect(screen.queryByRole("radio", { name: "Steady" })).toBeNull();
      if (i < 2) await next();
    }
  });

  it("saves nothing until the last step", async () => {
    const { storage } = renderSetup();
    const before = storage?.getItem(SETTINGS_KEY);
    await userEvent.type(screen.getByRole("textbox", { name: "Nickname" }), "Abby");
    await next();
    await userEvent.click(radio("Minimal"));
    await next();
    expect(storage?.getItem(SETTINGS_KEY)).toBe(before);
  });

  it("pre-selects an existing user's settings", async () => {
    renderSetup({ progressStyle: "bar", petInvolvement: "minimal", nickname: "Abby" });
    expect((screen.getByRole("textbox", { name: "Nickname" }) as HTMLInputElement).value).toBe("Abby");
    await next();
    expect(radio("Minimal").checked).toBe(true);
    await next();
    expect(radio("Bars").checked).toBe(true);
    expect(radio("Light").checked).toBe(true);
  });

  it("Back returns to the previous step with its answer kept", async () => {
    renderSetup();
    await userEvent.type(screen.getByRole("textbox", { name: "Nickname" }), "Abby");
    await next();
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    screen.getByText("Step 1 of 3");
    expect((screen.getByRole("textbox", { name: "Nickname" }) as HTMLInputElement).value).toBe("Abby");
  });

  it("Moderate says more mischief is coming", async () => {
    renderSetup();
    await next();
    screen.getByText(/More mischief coming in a future update/);
  });

  describe("Already use Studium? Sign in", () => {
    const LINK = "Already use Studium? Sign in";
    const signInFromSetup = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.click(screen.getByRole("button", { name: LINK }));
      expect(within(screen.getByRole("dialog")).getByRole("tab", { name: "Sign in" }).getAttribute("aria-selected")).toBe("true");
      await submitSignIn(user, "abby@example.com", "secret1");
    };

    it("with accounts on, step 1 offers 'Already use Studium? Sign in'", () => {
      renderWithAccount(<Setup theme="light" onTheme={vi.fn()} onFinish={vi.fn()} />, { settings: { setupDone: false } });
      screen.getByRole("button", { name: LINK });
    });

    it("only step 1 offers it", async () => {
      renderWithAccount(<Setup theme="light" onTheme={vi.fn()} onFinish={vi.fn()} />, { settings: { setupDone: false } });
      await next();
      expect(screen.queryByRole("button", { name: LINK })).toBeNull();
    });

    it("with accounts off, the link isn't shown", () => {
      renderWithAccount(<Setup theme="light" onTheme={vi.fn()} onFinish={vi.fn()} />, { auth: null, remote: null, settings: { setupDone: false } });
      expect(screen.queryByRole("button", { name: LINK })).toBeNull();
    });

    it("signing in there loads the account, sets setupDone and tutorialDone, and finishes setup", async () => {
      const user = userEvent.setup();
      const remote = new FakeRemote();
      await accountHas(remote, "u-abby@example.com", buildSeed(NOW));
      const onFinish = vi.fn();
      const { storage } = renderWithAccount(<Setup theme="light" onTheme={vi.fn()} onFinish={onFinish} />, {
        remote,
        data: emptyData(NOW), // a new device: nothing to choose between
        settings: { setupDone: false, tutorialDone: false, shopTutorialDone: false },
      });
      await user.type(screen.getByRole("textbox", { name: "Nickname" }), "Typed");
      await signInFromSetup(user);
      await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
      expect(stored(storage)).toMatchObject({ nickname: "Bee", setupDone: true, tutorialDone: true, shopTutorialDone: true });
    });

    it("with two saves, setup finishes once one is kept", async () => {
      const user = userEvent.setup();
      const remote = new FakeRemote();
      await accountHas(remote, "u-abby@example.com", withEgg(1).data);
      const onFinish = vi.fn();
      const { storage } = renderWithAccount(<Setup theme="light" onTheme={vi.fn()} onFinish={onFinish} />, { remote, settings: { setupDone: false } });
      await signInFromSetup(user);
      const picker = await screen.findByRole("dialog", { name: "You have two saves" });
      expect(onFinish).not.toHaveBeenCalled();
      await user.click(within(picker).getByRole("button", { name: "Keep my account's" }));
      await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
      expect(stored(storage)).toMatchObject({ setupDone: true, tutorialDone: true, shopTutorialDone: true });
    });

    it("closing the dialog without signing in leaves setup where it was", async () => {
      const user = userEvent.setup();
      const onFinish = vi.fn();
      const { storage } = renderWithAccount(<Setup theme="light" onTheme={vi.fn()} onFinish={onFinish} />, { settings: { setupDone: false } });
      await user.click(screen.getByRole("button", { name: LINK }));
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(screen.queryByRole("dialog")).toBeNull();
      screen.getByText("Step 1 of 3");
      expect(onFinish).not.toHaveBeenCalled();
      expect(stored(storage).setupDone).toBe(false);
    });

    it("if the account can't be reached, setup stays", async () => {
      const user = userEvent.setup();
      const remote = new FakeRemote();
      vi.spyOn(remote, "load").mockRejectedValue(new Error("offline"));
      const onFinish = vi.fn();
      renderWithAccount(<Setup theme="light" onTheme={vi.fn()} onFinish={onFinish} />, { remote, settings: { setupDone: false } });
      await signInFromSetup(user);
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      screen.getByText("Step 1 of 3");
      expect(onFinish).not.toHaveBeenCalled();
    });
  });

  it("choosing Dark switches the theme right away", async () => {
    const { onTheme, onFinish } = renderSetup();
    await next();
    await next();
    await userEvent.click(radio("Dark"));
    expect(onTheme).toHaveBeenCalledWith("dark");
    expect(onFinish).not.toHaveBeenCalled();
  });
});
