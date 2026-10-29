// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, SETTINGS_KEY } from "../store/settings";
import { memoryStorage, renderWithStudium, savedData, withEgg } from "../test/render";
import Settings from "./Settings";
import Overview from "./Overview";
import { NOW } from "../planner/testData";
import { emptyData } from "../store/seed";

describe("Overview", () => {
  it("uses the nickname in the heading", () => {
    renderWithStudium(<Overview onSelect={vi.fn()} onRequestComplete={vi.fn()} />, { settings: { nickname: "Abby" } });
    screen.getByRole("heading", { name: "Abby's Projects" });
  });

  it("with no projects shows 0% and a New project button", async () => {
    const onNewProject = vi.fn();
    renderWithStudium(<Overview onSelect={vi.fn()} onRequestComplete={vi.fn()} onNewProject={onNewProject} />, { data: emptyData(NOW) });
    expect(document.body.textContent).not.toMatch(/NaN/);
    expect(document.body.textContent).toMatch(/0%/);
    await userEvent.click(screen.getByRole("button", { name: "New project" }));
    expect(onNewProject).toHaveBeenCalled();
  });

  it("shows today's plan from the saved data", () => {
    renderWithStudium(<Overview onSelect={vi.fn()} onRequestComplete={vi.fn()} />);
    const today = screen.getByRole("region", { name: "Today" });
    within(today).getByText("Write case study #3");
    within(today).getByText("Weight paint character");
  });

  it("moves a suggestion into today", async () => {
    const { storage } = renderWithStudium(<Overview onSelect={vi.fn()} onRequestComplete={vi.fn()} />);
    const suggested = screen.getByRole("region", { name: "Suggested next" });
    const add = within(suggested).getAllByRole("button", { name: /^Add .* to today$/ })[0];
    const title = (add.getAttribute("aria-label") ?? "").replace(/^Add /, "").replace(/ to today$/, "");
    await userEvent.click(add);
    within(screen.getByRole("region", { name: "Today" })).getByText(title);
    expect(savedData(storage).today.taskIds.length).toBe(3);
  });

  it("completes from Today through the prompt and can remove items", async () => {
    const onRequestComplete = vi.fn();
    const { storage } = renderWithStudium(<Overview onSelect={vi.fn()} onRequestComplete={onRequestComplete} />);
    await userEvent.click(screen.getByRole("checkbox", { name: "Complete Write case study #3" }));
    expect(onRequestComplete).toHaveBeenCalledWith("webDev-t5");
    await userEvent.click(screen.getByRole("button", { name: "Remove Weight paint character from today" }));
    expect(savedData(storage).today.taskIds).toEqual(["webDev-t5"]);
  });

  it("shows each project's mood and opens it", async () => {
    const onSelect = vi.fn();
    renderWithStudium(<Overview onSelect={onSelect} onRequestComplete={vi.fn()} />);
    const card = screen.getByRole("button", { name: /Senior Capstone Project/ });
    within(card).getByText("Sick");
    await userEvent.click(card);
    expect(onSelect).toHaveBeenCalledWith("seniorCap");
  });

  it("shows total progress", () => {
    renderWithStudium(<Overview onSelect={vi.fn()} onRequestComplete={vi.fn()} />);
    screen.getByText("Total Progress — All Projects");
    screen.getByRole("heading", { name: "Your Projects" });
  });

  it("shows progress as rings by default (Circle)", () => {
    renderWithStudium(<Overview onSelect={vi.fn()} onRequestComplete={vi.fn()} />);
    screen.getByLabelText(/% total progress/);
    expect(screen.queryByRole("list", { name: "Progress by project" })).toBeNull();
  });

  it("shows one bar per project with the Bar style, and opens a project from its bar", async () => {
    const storage = memoryStorage();
    storage.setItem(SETTINGS_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, progressStyle: "bar" }));
    const onSelect = vi.fn();
    renderWithStudium(<Overview onSelect={onSelect} onRequestComplete={vi.fn()} />, { storage });
    const bars = screen.getByRole("list", { name: "Progress by project" });
    expect(within(bars).getAllByRole("progressbar")).toHaveLength(5);
    expect(screen.queryByLabelText(/% total progress/)).toBeNull();
    await userEvent.click(within(bars).getByRole("progressbar", { name: "webDev progress" }));
    expect(onSelect).toHaveBeenCalledWith("webDev");
  });

  it("switches style as soon as the setting changes", async () => {
    renderWithStudium(
      <>
        <Settings />
        <Overview onSelect={vi.fn()} onRequestComplete={vi.fn()} />
      </>,
    );
    await userEvent.click(screen.getByRole("radio", { name: "Bar" }));
    screen.getByRole("list", { name: "Progress by project" });
    await userEvent.click(screen.getByRole("radio", { name: "Circle" }));
    screen.getByLabelText(/% total progress/);
  });
});

describe("Overview egg cards", () => {
  it("shows Egg instead of a mood for a project that hasn't hatched", () => {
    const { data } = withEgg(1);
    renderWithStudium(<Overview onSelect={vi.fn()} onRequestComplete={vi.fn()} />, { data });
    const card = screen.getByRole("button", { name: /Novel/ });
    within(card).getByText("Egg");
    expect(within(card).queryByText(/ahead of plan|behind plan|On plan/)).toBeNull();
  });
});
