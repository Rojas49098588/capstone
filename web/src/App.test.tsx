// @vitest-environment jsdom
import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { dayKey } from "./planner/testData";
import { StudiumApp } from "./App";
import { renderWithStudium, savedData } from "./test/render";

describe("StudiumApp", () => {
  it("navigates between overview, a project and the shop", async () => {
    renderWithStudium(<StudiumApp />);
    screen.getByRole("heading", { name: "Your Projects" });
    await userEvent.click(screen.getAllByRole("button", { name: /appDev/ })[0]);
    screen.getByRole("heading", { name: "Mobile App — Habit Tracker" });
    await userEvent.click(screen.getAllByRole("button", { name: "Shop" })[0]);
    screen.getByRole("heading", { name: "Shop" });
    await userEvent.click(screen.getAllByRole("button", { name: "All Projects" })[0]);
    screen.getByRole("heading", { name: "Your Projects" });
  });

  it("completes from Today, then reopens on the project page", async () => {
    const { storage } = renderWithStudium(<StudiumApp />);
    await userEvent.click(screen.getByRole("checkbox", { name: "Complete Write case study #3" }));
    await userEvent.click(screen.getByRole("button", { name: "Save and complete" }));
    expect(screen.getByRole("status").textContent).toMatch(/\+\d+ tokens/);
    const balanceAfter = savedData(storage).events.filter((e) => e.type === "task_completed").length;
    await userEvent.click(screen.getAllByRole("button", { name: /webDev/ })[0]);
    await userEvent.click(screen.getByRole("checkbox", { name: "Reopen Write case study #3" }));
    expect(savedData(storage).tasks.find((t) => t.id === "webDev-t5")?.done).toBe(false);
    expect(savedData(storage).events.filter((e) => e.type === "task_completed").length).toBe(balanceAfter);
  });

  it("creates a project and shows it hatching", async () => {
    renderWithStudium(<StudiumApp />);
    await userEvent.click(screen.getByRole("button", { name: "+ New Project" }));
    await userEvent.type(screen.getByLabelText("Project name"), "Thesis Website");
    fireEvent.change(screen.getByLabelText("Deadline"), { target: { value: dayKey(40) } });
    await userEvent.click(screen.getAllByRole("radio", { name: /^Egg / })[0]);
    await userEvent.click(screen.getByRole("button", { name: "Create project" }));
    screen.getByRole("heading", { name: "Thesis Website" });
    screen.getByText(/^It hatched: a /);
  });

  it("returns to the overview when the open project is deleted", async () => {
    renderWithStudium(<StudiumApp />);
    await userEvent.click(screen.getAllByRole("button", { name: /webDev/ })[0]);
    await userEvent.click(screen.getByRole("button", { name: "Edit project" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete project" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    screen.getByRole("heading", { name: "Your Projects" });
  });

  it("warns when changes can't be saved", async () => {
    renderWithStudium(<StudiumApp />, { storage: null });
    const alert = screen.getByRole("alert");
    within(alert).getByText(/won't be saved/);
    await userEvent.click(within(alert).getByRole("button", { name: "Dismiss notice" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the token balance in the header", () => {
    renderWithStudium(<StudiumApp />);
    screen.getByText("650 tokens");
  });
});
