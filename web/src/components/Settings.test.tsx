// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SETTINGS_KEY } from "../store/settings";
import { renderWithStudium } from "../test/render";
import Settings from "./Settings";

describe("Settings", () => {
  it("shows the account section and the settings with their defaults", () => {
    renderWithStudium(<Settings />);
    screen.getByRole("heading", { name: "User Settings" });
    screen.getByRole("heading", { name: "Account" });
    screen.getByText("Email");
    screen.getByText("Nickname");
    screen.getByRole("heading", { name: "Settings" });
    expect((screen.getByRole("radio", { name: "Steady" }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("radio", { name: "School" }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("radio", { name: "Project order" }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("radio", { name: "Circle" }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("radio", { name: "Mild" }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("textbox", { name: "Nickname" }) as HTMLInputElement).value).toBe("");
    const count = screen.getByRole("combobox", { name: "Pets on screen at once" }) as HTMLSelectElement;
    expect(count.value).toBe("all");
    // All pets, or 1 up to the number of projects (5 in the example data).
    expect([...count.options].map((o) => o.value)).toEqual(["all", "1", "2", "3", "4", "5"]);
  });

  it("saves each change", async () => {
    const { storage } = renderWithStudium(<Settings />);
    await userEvent.click(screen.getByRole("radio", { name: "Strict" }));
    await userEvent.click(screen.getByRole("radio", { name: "Closest due date" }));
    await userEvent.click(screen.getByRole("radio", { name: "Bar" }));
    await userEvent.click(screen.getByRole("radio", { name: "Minimal" }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Pets on screen at once" }), "2");
    expect(JSON.parse(storage?.getItem(SETTINGS_KEY) as string)).toEqual({
      difficulty: "strict",
      petCount: 2,
      petOrder: "dueDate",
      progressStyle: "bar",
      petInvolvement: "minimal",
      nickname: "",
      projectType: "school",
      setupDone: false,
      tutorialDone: true,
      shopTutorialDone: true,
    });
  });

  it("saves the nickname and the default project type", async () => {
    const { storage } = renderWithStudium(<Settings />);
    await userEvent.type(screen.getByRole("textbox", { name: "Nickname" }), "Abby");
    await userEvent.click(screen.getByRole("radio", { name: "Art & design" }));
    expect(JSON.parse(storage?.getItem(SETTINGS_KEY) as string)).toMatchObject({ nickname: "Abby", projectType: "art" });
  });
});
