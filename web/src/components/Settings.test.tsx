// @vitest-environment jsdom
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
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
    // Sounds only play in the desktop app.
    expect(screen.queryByRole("heading", { name: "Sound" })).toBeNull();
    // A new project starts with the type and difficulty used last, so neither is a setting.
    expect(screen.queryByRole("radio", { name: "Steady" })).toBeNull();
    expect(screen.queryByRole("radio", { name: "School" })).toBeNull();
    expect((screen.getByRole("radio", { name: "Project order" })as HTMLInputElement).checked).toBe(true);
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
    await userEvent.click(screen.getByRole("radio", { name: "Closest due date" }));
    await userEvent.click(screen.getByRole("radio", { name: "Bar" }));
    await userEvent.click(screen.getByRole("radio", { name: "Minimal" }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Pets on screen at once" }), "2");
    expect(JSON.parse(storage?.getItem(SETTINGS_KEY) as string)).toEqual({
      difficulty: "steady",
      petCount: 2,
      petOrder: "dueDate",
      progressStyle: "bar",
      petInvolvement: "minimal",
      nickname: "",
      projectType: "school",
      setupDone: true,
      tutorialDone: true,
      shopTutorialDone: true,
      startWithComputer: true,
      startQuietly: false,
      petSounds: true,
      petVolume: 30,
      soundBubbles: true,
    });
  });

  it("saves the nickname", async () => {
    const { storage } = renderWithStudium(<Settings />);
    await userEvent.type(screen.getByRole("textbox", { name: "Nickname" }), "Abby");
    expect(JSON.parse(storage?.getItem(SETTINGS_KEY) as string)).toMatchObject({ nickname: "Abby" });
  });

  describe("in the desktop app", () => {
    afterEach(() => {
      delete window.studiumDesktop;
    });

    it("has a Sound section: pet sounds on, volume at 30%, sound bubbles on", () => {
      window.studiumDesktop = { desktop: true };
      renderWithStudium(<Settings />);
      screen.getByRole("heading", { name: "Sound" });
      expect((screen.getByRole("checkbox", { name: "Pet sounds" }) as HTMLInputElement).checked).toBe(true);
      const volume = screen.getByRole("slider", { name: "Volume" }) as HTMLInputElement;
      expect(volume.value).toBe("30");
      expect(volume.disabled).toBe(false);
      screen.getByText("30%");
      expect((screen.getByRole("checkbox", { name: "Sound bubbles" }) as HTMLInputElement).checked).toBe(true);
    });

    it("can turn pet sounds off, which greys out the volume", async () => {
      window.studiumDesktop = { desktop: true };
      const { storage } = renderWithStudium(<Settings />);
      await userEvent.click(screen.getByRole("checkbox", { name: "Pet sounds" }));
      expect(JSON.parse(storage?.getItem(SETTINGS_KEY) as string)).toMatchObject({ petSounds: false });
      expect((screen.getByRole("slider", { name: "Volume" }) as HTMLInputElement).disabled).toBe(true);
    });

    it("saves the volume and sound bubbles", async () => {
      window.studiumDesktop = { desktop: true };
      const { storage } = renderWithStudium(<Settings />);
      fireEvent.change(screen.getByRole("slider", { name: "Volume" }), { target: { value: "75" } });
      screen.getByText("75%");
      await userEvent.click(screen.getByRole("checkbox", { name: "Sound bubbles" }));
      expect(JSON.parse(storage?.getItem(SETTINGS_KEY) as string)).toMatchObject({ petVolume: 75, soundBubbles: false, petSounds: true });
    });

    it("can stop Studium from starting with the computer", async () => {
      window.studiumDesktop = { desktop: true };
      const { storage } = renderWithStudium(<Settings />);
      const box = screen.getByRole("checkbox", { name: "Start Studium when your computer starts" }) as HTMLInputElement;
      expect(box.checked).toBe(true);
      await userEvent.click(box);
      expect(JSON.parse(storage?.getItem(SETTINGS_KEY) as string)).toMatchObject({ startWithComputer: false });
    });

    it("chooses whether Studium opens its window or starts quietly in the tray", async () => {
      window.studiumDesktop = { desktop: true };
      const { storage } = renderWithStudium(<Settings />);
      expect((screen.getByRole("radio", { name: "Open the window" }) as HTMLInputElement).checked).toBe(true);
      await userEvent.click(screen.getByRole("radio", { name: "Start quietly in the tray" }));
      expect(JSON.parse(storage?.getItem(SETTINGS_KEY) as string)).toMatchObject({ startQuietly: true });
      await userEvent.click(screen.getByRole("radio", { name: "Open the window" }));
      expect(JSON.parse(storage?.getItem(SETTINGS_KEY) as string)).toMatchObject({ startQuietly: false });
    });

    it("hides the choice when Studium doesn't start with the computer", async () => {
      window.studiumDesktop = { desktop: true };
      renderWithStudium(<Settings />);
      await userEvent.click(screen.getByRole("checkbox", { name: "Start Studium when your computer starts" }));
      expect(screen.queryByRole("radio", { name: "Start quietly in the tray" })).toBeNull();
    });
  });

  it("doesn't offer starting with the computer in a browser", () => {
    renderWithStudium(<Settings />);
    expect(screen.queryByRole("checkbox", { name: "Start Studium when your computer starts" })).toBeNull();
    expect(screen.queryByRole("checkbox", { name: "Pet sounds" })).toBeNull();
  });
});
