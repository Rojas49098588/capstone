// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SETTINGS_KEY } from "../store/settings";
import { memoryStorage, renderWithStudium } from "../test/render";
import Settings from "./Settings";

describe("Settings", () => {
  it("shows the account section and the settings with their defaults", () => {
    renderWithStudium(<Settings storage={memoryStorage()} />);
    screen.getByRole("heading", { name: "User Settings" });
    screen.getByRole("heading", { name: "Account" });
    screen.getByText("Email");
    screen.getByText("Nickname");
    screen.getByRole("heading", { name: "Settings" });
    expect((screen.getByRole("radio", { name: "Easy" }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("radio", { name: "Bar" }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("radio", { name: "Very" }) as HTMLInputElement).checked).toBe(true);
    const count = screen.getByRole("combobox", { name: "Pets on screen at once" }) as HTMLSelectElement;
    expect(count.value).toBe("all");
    // All pets, or 1 up to the number of projects (5 in the example data).
    expect([...count.options].map((o) => o.value)).toEqual(["all", "1", "2", "3", "4", "5"]);
  });

  it("saves each change", async () => {
    const storage = memoryStorage();
    renderWithStudium(<Settings storage={storage} />);
    await userEvent.click(screen.getByRole("radio", { name: "Hard" }));
    await userEvent.click(screen.getByRole("radio", { name: "Circle" }));
    await userEvent.click(screen.getByRole("radio", { name: "Not much" }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Pets on screen at once" }), "2");
    expect(JSON.parse(storage.getItem(SETTINGS_KEY) as string)).toEqual({
      difficulty: "hard",
      petCount: 2,
      progressStyle: "circle",
      petInvolvement: "notMuch",
    });
  });
});
