// @vitest-environment jsdom
import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { StudiumApp } from "../App";
import { NOW, dayKey } from "../planner/testData";
import type { StudiumData } from "../planner/types";
import { buildSeed } from "../store/seed";
import { SETTINGS_KEY } from "../store/settings";
import { renderWithStudium } from "../test/render";
import { TOUR_STEPS } from "../ui/tourSteps";
import { cardPosition } from "./Tour";

const tourTitle = () => within(screen.getByRole("dialog")).getByRole("heading").textContent;
const savedSettings = (storage: Storage | null) => JSON.parse(storage?.getItem(SETTINGS_KEY) ?? "{}");

// These render the whole app and click through every step.
describe("tutorial tour", { timeout: 20_000 }, () => {
  it("starts the first time a project page opens, and walks through the project page, the Overview and the Shop", async () => {
    const { storage } = renderWithStudium(<StudiumApp />, { tutorial: true });
    expect(screen.queryByRole("dialog")).toBeNull(); // not on the Overview
    await userEvent.click(screen.getAllByRole("button", { name: /webDev/ })[0]);

    for (let i = 0; i < TOUR_STEPS.length; i++) {
      const step = TOUR_STEPS[i];
      expect(tourTitle()).toBe(step.title);
      within(screen.getByRole("dialog")).getByText(`Tutorial · ${i + 1} of ${TOUR_STEPS.length}`);
      // Each target is on the step's page (a typo in a data-tour name would leave it unlit).
      if (step.target) expect(document.querySelector(`[data-tour="${step.target}"]`), step.target).not.toBeNull();
      if (step.page === "project") screen.getByRole("heading", { name: "Web Development Portfolio" });
      if (step.page === "overview") screen.getByRole("heading", { name: "Your Projects" });
      if (step.page === "shop") screen.getByRole("heading", { name: "Shop" });
      const last = i === TOUR_STEPS.length - 1;
      await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: last ? "Finish" : "Next" }));
    }
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(savedSettings(storage).tutorialDone).toBe(true);

    // It doesn't come back on the next project page.
    await userEvent.click(screen.getAllByRole("button", { name: /appDev/ })[0]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Back goes to the previous step, and Skip ends it for good", async () => {
    const { storage } = renderWithStudium(<StudiumApp />, { tutorial: true });
    await userEvent.click(screen.getAllByRole("button", { name: /webDev/ })[0]);
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(tourTitle()).toBe(TOUR_STEPS[1].title);
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(tourTitle()).toBe(TOUR_STEPS[0].title);
    await userEvent.click(screen.getByRole("button", { name: "Skip tour" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(savedSettings(storage).tutorialDone).toBe(true);
  });

  it("Escape skips the tour", async () => {
    renderWithStudium(<StudiumApp />, { tutorial: true });
    await userEvent.click(screen.getAllByRole("button", { name: /webDev/ })[0]);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("starts right after creating the first project, when there were none", async () => {
    const empty: StudiumData = {
      ...buildSeed(NOW),
      projects: [],
      requirements: [],
      tasks: [],
      events: [],
      decor: {},
      today: { date: dayKey(0), taskIds: [] },
    };
    renderWithStudium(<StudiumApp />, { data: empty, tutorial: true });
    await userEvent.click(screen.getByRole("button", { name: "+ New Project" }));
    await userEvent.type(screen.getByLabelText("Project name"), "Thesis");
    fireEvent.change(screen.getByLabelText("Deadline"), { target: { value: dayKey(40) } });
    await userEvent.click(screen.getAllByRole("radio", { name: /^Egg / })[0]);
    await userEvent.click(screen.getByRole("button", { name: "Create project" }));
    screen.getByRole("heading", { name: "Thesis" });
    expect(tourTitle()).toBe("Welcome to your project");
  });

  it("Replay tutorial in Settings starts it again", async () => {
    renderWithStudium(<StudiumApp />);
    await userEvent.click(screen.getByRole("button", { name: "Settings" }));
    await userEvent.click(screen.getByRole("button", { name: "Replay tutorial" }));
    expect(tourTitle()).toBe("Welcome to your project");
    screen.getByRole("heading", { name: "Web Development Portfolio" });
  });

  it("Replay with no projects shows only the Overview and Shop steps", async () => {
    const empty: StudiumData = { ...buildSeed(NOW), projects: [], requirements: [], tasks: [], events: [], decor: {} };
    renderWithStudium(<StudiumApp />, { data: empty });
    await userEvent.click(screen.getByRole("button", { name: "Settings" }));
    await userEvent.click(screen.getByRole("button", { name: "Replay tutorial" }));
    const count = TOUR_STEPS.filter((s) => s.page !== "project").length;
    within(screen.getByRole("dialog")).getByText(`Tutorial · 1 of ${count}`);
    expect(tourTitle()).toBe("The Overview");
  });
});

describe("cardPosition", () => {
  it("puts the card below the highlight, above it near the bottom, and in the middle without one", () => {
    const viewport = { width: 1000, height: 800 };
    expect(cardPosition({ top: 100, left: 400, width: 200, height: 50 }, 180, viewport).top).toBe(162);
    expect(cardPosition({ top: 600, left: 400, width: 200, height: 100 }, 180, viewport).top).toBe(408);
    expect(cardPosition(null, 200, viewport)).toEqual({ width: 360, left: 320, top: 300 });
    expect(cardPosition({ top: 100, left: 0, width: 50, height: 50 }, 180, { width: 320, height: 800 }).left).toBe(16);
  });
});
