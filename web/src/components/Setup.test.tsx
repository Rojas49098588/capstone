// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SETTINGS_KEY } from "../store/settings";
import { renderWithStudium } from "../test/render";
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

  it("choosing Dark switches the theme right away", async () => {
    const { onTheme, onFinish } = renderSetup();
    await next();
    await next();
    await userEvent.click(radio("Dark"));
    expect(onTheme).toHaveBeenCalledWith("dark");
    expect(onFinish).not.toHaveBeenCalled();
  });
});
