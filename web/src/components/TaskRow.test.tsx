// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NOW, makeData, makeRequirement, makeTask } from "../planner/testData";
import { buildSeed } from "../store/seed";
import { renderWithStudium, savedData, withFocus } from "../test/render";
import TaskRow from "./TaskRow";

const task = (storage: Storage | null, id: string) => savedData(storage).tasks.find((t) => t.id === id);


// Prototype 9 and 10 each have a "Git commit"; Prototype 10 waits on Prototype 9.
const prototypes = () =>
  makeData({
    requirements: [
      makeRequirement({ id: "P9", title: "Prototype 9" }),
      makeRequirement({ id: "P10", title: "Prototype 10", blockedBy: ["P9"] }),
      makeRequirement({ id: "P11", title: "Prototype 11" }),
    ],
    tasks: [
      makeTask({ id: "c9", requirementId: "P9", title: "Git commit" }),
      makeTask({ id: "c10", requirementId: "P10", title: "Git commit" }),
      makeTask({ id: "apk", requirementId: "P10", title: "APK", blockedBy: ["c9"] }),
    ],
  });

describe("TaskRow", () => {
  it("locks a task whose requirement is waiting and says why", () => {
    renderWithStudium(<TaskRow taskId="c10" onRequestComplete={vi.fn()} />, { data: prototypes() });
    expect((screen.getByRole("checkbox", { name: "Complete Git commit" }) as HTMLButtonElement).disabled).toBe(true);
    screen.getByText("Waiting on Prototype 9");
  });

  it("counts every blocker and adds the requirement to a repeated task name", async () => {
    renderWithStudium(<TaskRow taskId="apk" onRequestComplete={vi.fn()} />, { data: prototypes() });
    await userEvent.hover(screen.getByRole("button", { name: "Waiting on 2" }));
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Git commit (Prototype 9)", "Prototype 9"]);
  });

  it("locks a blocked task and says what it's waiting on", () => {
    renderWithStudium(<TaskRow taskId="webDev-t8" onRequestComplete={vi.fn()} />);
    expect((screen.getByRole("checkbox", { name: "Complete Deploy to Vercel" }) as HTMLButtonElement).disabled).toBe(true);
    screen.getByText("Waiting on Contact form with validation");
  });

  it("asks for the time before completing an open task", async () => {
    const onRequestComplete = vi.fn();
    renderWithStudium(<TaskRow taskId="webDev-t6" onRequestComplete={onRequestComplete} />);
    await userEvent.click(screen.getByRole("checkbox", { name: "Complete Record demo videos" }));
    expect(onRequestComplete).toHaveBeenCalledWith("webDev-t6");
  });

  it("reopens a done task", async () => {
    const { storage } = renderWithStudium(<TaskRow taskId="webDev-t3" onRequestComplete={vi.fn()} />);
    await userEvent.click(screen.getByRole("checkbox", { name: "Reopen Write case study #1" }));
    expect(task(storage, "webDev-t3")?.done).toBe(false);
    screen.getByRole("checkbox", { name: "Complete Write case study #1" });
  });

  it("adds to and removes from today", async () => {
    const { storage } = renderWithStudium(<TaskRow taskId="webDev-t6" onRequestComplete={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "+ Today" }));
    expect(savedData(storage).today.taskIds).toContain("webDev-t6");
    await userEvent.click(screen.getByRole("button", { name: "In today" }));
    expect(savedData(storage).today.taskIds).not.toContain("webDev-t6");
  });

  it("pins, edits and deletes", async () => {
    const { storage } = renderWithStudium(<TaskRow taskId="webDev-t6" onRequestComplete={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Pin Record demo videos" }));
    expect(task(storage, "webDev-t6")?.priority).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Edit Record demo videos" }));
    await userEvent.clear(screen.getByLabelText("Task title"));
    await userEvent.type(screen.getByLabelText("Task title"), "Record demos");
    await userEvent.click(screen.getByRole("button", { name: "Save task" }));
    screen.getByText("Record demos");
    await userEvent.click(screen.getByRole("button", { name: "Delete Record demos" }));
    expect(task(storage, "webDev-t6")).toBeUndefined();
  });

  it("links an unlinked task to a requirement", async () => {
    const data = buildSeed(NOW);
    data.tasks = data.tasks.map((t) => (t.id === "webDev-t6" ? { ...t, requirementId: null } : t));
    const { storage } = renderWithStudium(<TaskRow taskId="webDev-t6" onRequestComplete={vi.fn()} />, { data });
    await userEvent.selectOptions(screen.getByLabelText("Link Record demo videos to a requirement"), "webDev-r2");
    expect(task(storage, "webDev-t6")?.requirementId).toBe("webDev-r2");
  });
});

describe("TaskRow focus time", () => {
  it("shows focus time since the task was last reopened", () => {
    renderWithStudium(<TaskRow taskId="webDev-t5" onRequestComplete={vi.fn()} />, { data: withFocus(45) });
    screen.getByText(/Focused 45 min/);
  });

  it("shows nothing without focus time", () => {
    renderWithStudium(<TaskRow taskId="webDev-t5" onRequestComplete={vi.fn()} />);
    expect(screen.queryByText(/Focused/)).toBeNull();
  });
});
