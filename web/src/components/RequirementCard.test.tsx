// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithStudium, savedData } from "../test/render";
import RequirementCard from "./RequirementCard";

describe("RequirementCard", () => {
  it("shows weight, progress against plan and its tasks", () => {
    renderWithStudium(<RequirementCard requirementId="webDev-r2" onRequestComplete={vi.fn()} />);
    screen.getByText(/Weight 5/);
    screen.getByRole("progressbar", { name: "Case studies progress" });
    screen.getByText(/% done · plan \d+%/);
    screen.getByText("Write case study #3");
  });

  it("flags a neglected requirement", () => {
    renderWithStudium(<RequirementCard requirementId="Animation-r2" onRequestComplete={vi.fn()} />);
    screen.getByText("9 days idle");
  });

  it("adds a task to itself", async () => {
    const { storage } = renderWithStudium(<RequirementCard requirementId="webDev-r2" onRequestComplete={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "+ Add task" }));
    await userEvent.type(screen.getByLabelText("Task title"), "Write case study #4");
    await userEvent.click(screen.getByRole("button", { name: "Add task" }));
    const added = savedData(storage).tasks.find((t) => t.title === "Write case study #4");
    expect(added?.requirementId).toBe("webDev-r2");
    screen.getByText("Write case study #4");
  });

  it("edits the weight", async () => {
    renderWithStudium(<RequirementCard requirementId="webDev-r2" onRequestComplete={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Edit Case studies" }));
    await userEvent.clear(screen.getByLabelText("Weight (1–10)"));
    await userEvent.type(screen.getByLabelText("Weight (1–10)"), "8");
    await userEvent.click(screen.getByRole("button", { name: "Save requirement" }));
    screen.getByText(/Weight 8/);
  });

  it("moves its tasks to Unlinked when deleted that way", async () => {
    const { storage } = renderWithStudium(<RequirementCard requirementId="webDev-r2" onRequestComplete={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Delete Case studies" }));
    await userEvent.click(screen.getByRole("button", { name: "Move tasks to Unlinked" }));
    const saved = savedData(storage);
    expect(saved.requirements.some((r) => r.id === "webDev-r2")).toBe(false);
    expect(saved.tasks.filter((t) => ["webDev-t3", "webDev-t4", "webDev-t5", "webDev-t6"].includes(t.id)).every((t) => t.requirementId === null)).toBe(true);
  });
});
