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
import { PROJECT_TOUR_STEPS, SHOP_TOUR_STEPS, type TourStep } from "../ui/tourSteps";
import { cardPosition } from "./Tour";

const tourTitle = () => within(screen.getByRole("dialog")).getByRole("heading").textContent;
const savedSettings = (storage: Storage | null) => JSON.parse(storage?.getItem(SETTINGS_KEY) ?? "{}");

// These render the whole app and click through every step.
async function walkThrough(steps: TourStep[], projectHeading: string) {
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    expect(tourTitle()).toBe(step.title);
    within(screen.getByRole("dialog")).getByText(`Tutorial · ${i + 1} of ${steps.length}`);
    // Each target is on the step's page (a typo in a data-tour name would leave it unlit).
    if (step.target) expect(document.querySelector(`[data-tour="${step.target}"]`), step.target).not.toBeNull();
    if (step.page === "project") screen.getByRole("heading", { name: projectHeading });
    if (step.page === "overview") screen.getByRole("heading", { name: "Your Projects" });
    if (step.page === "shop") screen.getByRole("heading", { name: "Shop" });
    if (step.page === "settings") screen.getByRole("heading", { name: "User Settings" });
    if (step.shopTab) expect(screen.getByRole("tab", { name: "Habitat" }).getAttribute("aria-selected")).toBe("true");
    const last = i === steps.length - 1;
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: last ? "Finish" : "Next" }));
  }
  expect(screen.queryByRole("dialog")).toBeNull();
}

const openShop = () => userEvent.click(screen.getAllByRole("button", { name: "Shop" })[0]);

describe("tutorial tours", { timeout: 30_000 }, () => {
  it("the project tutorial starts the first time a project page opens, covers the project page and the Overview, and ends in Settings", async () => {
    const { storage } = renderWithStudium(<StudiumApp />, { tutorial: true });
    expect(screen.queryByRole("dialog")).toBeNull(); // not on the Overview
    await userEvent.click(screen.getAllByRole("button", { name: /webDev/ })[0]);

    expect(PROJECT_TOUR_STEPS.some((s) => s.page === "shop")).toBe(false);
    expect(PROJECT_TOUR_STEPS[PROJECT_TOUR_STEPS.length - 1].page).toBe("settings");
    await walkThrough(PROJECT_TOUR_STEPS, "Web Development Portfolio");
    expect(savedSettings(storage).tutorialDone).toBe(true);
    expect(savedSettings(storage).shopTutorialDone).toBe(false);

    // It doesn't come back on the next project page.
    await userEvent.click(screen.getAllByRole("button", { name: /appDev/ })[0]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("the shop tutorial starts the first time the Shop opens, shows habitat decor on a project page, and ends in Settings", async () => {
    const { storage } = renderWithStudium(<StudiumApp />, { settings: { tutorialDone: true, shopTutorialDone: false } });
    expect(screen.queryByRole("dialog")).toBeNull();
    await openShop();

    expect(SHOP_TOUR_STEPS.some((s) => s.page === "project")).toBe(true);
    expect(SHOP_TOUR_STEPS[SHOP_TOUR_STEPS.length - 1].page).toBe("settings");
    await walkThrough(SHOP_TOUR_STEPS, "Web Development Portfolio");
    expect(savedSettings(storage).shopTutorialDone).toBe(true);

    // It doesn't come back on the next visit.
    await openShop();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Back goes to the previous step, and Skip ends only that tutorial for good", async () => {
    const { storage } = renderWithStudium(<StudiumApp />, { tutorial: true });
    await userEvent.click(screen.getAllByRole("button", { name: /webDev/ })[0]);
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(tourTitle()).toBe(PROJECT_TOUR_STEPS[1].title);
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(tourTitle()).toBe(PROJECT_TOUR_STEPS[0].title);
    await userEvent.click(screen.getByRole("button", { name: "Skip tour" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(savedSettings(storage).tutorialDone).toBe(true);
    expect(savedSettings(storage).shopTutorialDone).toBe(false);

    await openShop();
    expect(tourTitle()).toBe(SHOP_TOUR_STEPS[0].title);
    await userEvent.click(screen.getByRole("button", { name: "Skip tour" }));
    expect(savedSettings(storage).shopTutorialDone).toBe(true);
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

  it("Settings replays each tutorial on its own", async () => {
    renderWithStudium(<StudiumApp />);
    await userEvent.click(screen.getByRole("button", { name: "Settings" }));
    await userEvent.click(screen.getByRole("button", { name: "Replay project tutorial" }));
    expect(tourTitle()).toBe("Welcome to your project");
    within(screen.getByRole("dialog")).getByText(`Tutorial · 1 of ${PROJECT_TOUR_STEPS.length}`);
    screen.getByRole("heading", { name: "Web Development Portfolio" });
    await userEvent.click(screen.getByRole("button", { name: "Skip tour" }));

    await userEvent.click(screen.getByRole("button", { name: "Settings" }));
    await userEvent.click(screen.getByRole("button", { name: "Replay shop tutorial" }));
    expect(tourTitle()).toBe(SHOP_TOUR_STEPS[0].title);
    within(screen.getByRole("dialog")).getByText(`Tutorial · 1 of ${SHOP_TOUR_STEPS.length}`);
    screen.getByRole("heading", { name: "Shop" });
  });

  it("with no projects, both tutorials leave out the project page steps", async () => {
    const empty: StudiumData = { ...buildSeed(NOW), projects: [], requirements: [], tasks: [], events: [], decor: {} };
    renderWithStudium(<StudiumApp />, { data: empty });
    await userEvent.click(screen.getByRole("button", { name: "Settings" }));
    await userEvent.click(screen.getByRole("button", { name: "Replay project tutorial" }));
    const count = PROJECT_TOUR_STEPS.filter((s) => s.page !== "project").length;
    within(screen.getByRole("dialog")).getByText(`Tutorial · 1 of ${count}`);
    expect(tourTitle()).toBe("The Overview");
    await userEvent.click(screen.getByRole("button", { name: "Skip tour" }));

    await userEvent.click(screen.getByRole("button", { name: "Settings" }));
    await userEvent.click(screen.getByRole("button", { name: "Replay shop tutorial" }));
    await walkThrough(SHOP_TOUR_STEPS.filter((s) => s.page !== "project"), "");
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
