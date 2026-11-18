// @vitest-environment jsdom
import { act, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NOW, completed, dayKey, daysAgo, makeData, makeProject, makeRequirement, makeTask } from "../planner/testData";
import { renderWithStudium, savedData } from "../test/render";
import RequirementCard from "./RequirementCard";


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

describe("RequirementCard", () => {
  it("shows what a requirement is waiting on", () => {
    renderWithStudium(<RequirementCard requirementId="P10" onRequestComplete={vi.fn()} />, { data: prototypes() });
    // Under the title, and again on its locked task.
    expect(screen.getAllByText("Waiting on Prototype 9")).toHaveLength(2);
  });

  it("edits a requirement's Blocked by, including All other requirements", async () => {
    const { storage } = renderWithStudium(<RequirementCard requirementId="P11" onRequestComplete={vi.fn()} />, { data: prototypes() });
    await userEvent.click(screen.getByRole("button", { name: "Edit Prototype 11" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Prototype 10" }));
    await userEvent.click(screen.getByRole("button", { name: "Save requirement" }));
    expect(savedData(storage).requirements.find((r) => r.id === "P11")?.blockedBy).toEqual(["P10"]);
    screen.getByText("Waiting on Prototype 10");
    await userEvent.click(screen.getByRole("button", { name: "Edit Prototype 11" }));
    expect((screen.getByRole("checkbox", { name: "Prototype 10" }) as HTMLInputElement).checked).toBe(true);
    await userEvent.click(screen.getByRole("checkbox", { name: "All other requirements" }));
    expect((screen.getByRole("checkbox", { name: "Prototype 9" }) as HTMLInputElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Save requirement" }));
    expect(savedData(storage).requirements.find((r) => r.id === "P11")).toMatchObject({ blockedByAll: true, blockedBy: [] });
    screen.getByRole("button", { name: "Waiting on 2" });
  });

  it("duplicates from the card", async () => {
    const onHatch = vi.fn();
    const { storage } = renderWithStudium(<RequirementCard requirementId="P10" onRequestComplete={vi.fn()} onHatch={onHatch} />, { data: prototypes() });
    await userEvent.click(screen.getByRole("button", { name: "Duplicate Prototype 10" }));
    // Prototype 11 already exists, so the copy is Prototype 12.
    const copy = savedData(storage).requirements.find((r) => r.title === "Prototype 12");
    expect(copy).toMatchObject({ blockedBy: ["P10"] });
    expect(savedData(storage).tasks.filter((t) => t.requirementId === copy!.id).map((t) => t.title)).toEqual(["Git commit", "APK"]);
    expect(onHatch).not.toHaveBeenCalled();
  });

  it("doesn't offer blockers that would loop", async () => {
    renderWithStudium(<RequirementCard requirementId="P9" onRequestComplete={vi.fn()} />, { data: prototypes() });
    await userEvent.click(screen.getByRole("button", { name: "Edit Prototype 9" }));
    expect(screen.queryByRole("checkbox", { name: "Prototype 10" })).toBeNull();
    screen.getByRole("checkbox", { name: "Prototype 11" });
  });

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

  it("shows days idle using the project's difficulty", () => {
    const data = (difficulty: "strict" | "steady") =>
      makeData({
        projects: [makeProject({ difficulty })],
        requirements: [makeRequirement({ title: "Draft", startDate: dayKey(-20), dueDate: dayKey(20) })],
        tasks: [makeTask({ id: "t1", done: true }), makeTask({ id: "t2" })],
        events: [completed("t1", daysAgo(4))],
      });
    const { unmount } = renderWithStudium(<RequirementCard requirementId="r1" onRequestComplete={vi.fn()} />, { data: data("strict"), now: NOW });
    screen.getByText("4 days idle");
    unmount();
    renderWithStudium(<RequirementCard requirementId="r1" onRequestComplete={vi.fn()} />, { data: data("steady"), now: NOW });
    expect(screen.queryByText("4 days idle")).toBeNull();
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

describe("reordering a requirement's tasks", () => {
  const titles = () => screen.getAllByText(/^(Git commit|APK|Slides)$/).map((el) => el.textContent);

  it("Move up reorders the tasks, saves it, and keeps focus", async () => {
    const { storage } = renderWithStudium(<RequirementCard requirementId="P10" onRequestComplete={vi.fn()} />, { data: prototypes() });
    expect(titles()).toEqual(["Git commit", "APK"]);
    await userEvent.click(screen.getByRole("button", { name: "Move APK up" }));
    expect(titles()).toEqual(["APK", "Git commit"]);
    const saved = savedData(storage).tasks;
    expect(saved.find((t) => t.id === "apk")?.order).toBe(0);
    expect(saved.find((t) => t.id === "c10")?.order).toBe(1);
    // APK is first now, so Move up is off and focus is on Move down.
    expect((screen.getByRole("button", { name: "Move APK up" }) as HTMLButtonElement).disabled).toBe(true);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Move APK down" }));
    await userEvent.click(screen.getByRole("button", { name: "Move APK down" }));
    expect(titles()).toEqual(["Git commit", "APK"]);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Move APK up" }));
  });

  it("done tasks have no move buttons", () => {
    const data = prototypes();
    data.tasks.push(makeTask({ id: "s", requirementId: "P10", title: "Slides", done: true }));
    renderWithStudium(<RequirementCard requirementId="P10" onRequestComplete={vi.fn()} />, { data });
    expect(screen.queryByRole("button", { name: "Move Slides up" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Move Slides down" })).toBeNull();
    expect(titles()).toEqual(["Git commit", "APK", "Slides"]);
  });

  it("dragging the grip drops a task in a new place", () => {
    const { storage, container } = renderWithStudium(<RequirementCard requirementId="P10" onRequestComplete={vi.fn()} />, { data: prototypes() });
    const rows = [...container.querySelectorAll<HTMLElement>("[data-reorder-row]")];
    expect(rows).toHaveLength(2);
    rows.forEach((row, i) => {
      row.getBoundingClientRect = () => ({ top: i * 40, bottom: i * 40 + 40, height: 40, left: 0, right: 300, width: 300, x: 0, y: i * 40, toJSON: () => ({}) });
    });
    const grip = rows[1].querySelector("[data-grip]") as HTMLElement;
    grip.dispatchEvent(new MouseEvent("pointerdown", { clientY: 60, button: 0, bubbles: true }));
    window.dispatchEvent(new MouseEvent("pointermove", { clientY: 5, bubbles: true }));
    act(() => {
      window.dispatchEvent(new MouseEvent("pointerup", { clientY: 5, bubbles: true }));
    });
    expect(titles()).toEqual(["APK", "Git commit"]);
    expect(savedData(storage).tasks.find((t) => t.id === "apk")?.order).toBe(0);
  });

  it("pressing the grip doesn't start a text selection", () => {
    const { container } = renderWithStudium(<RequirementCard requirementId="P10" onRequestComplete={vi.fn()} />, { data: prototypes() });
    const grip = container.querySelector("[data-grip]") as HTMLElement;
    const down = new MouseEvent("mousedown", { button: 0, bubbles: true, cancelable: true });
    grip.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
  });

  it("Escape cancels a drag", () => {
    const { container } = renderWithStudium(<RequirementCard requirementId="P10" onRequestComplete={vi.fn()} />, { data: prototypes() });
    const rows = [...container.querySelectorAll<HTMLElement>("[data-reorder-row]")];
    const grip = rows[1].querySelector("[data-grip]") as HTMLElement;
    grip.dispatchEvent(new MouseEvent("pointerdown", { clientY: 60, button: 0, bubbles: true }));
    fireEvent.keyDown(window, { key: "Escape" });
    act(() => {
      window.dispatchEvent(new MouseEvent("pointerup", { clientY: 5, bubbles: true }));
    });
    expect(titles()).toEqual(["Git commit", "APK"]);
  });
});

describe("sublabels", () => {
  it("sets, shows, edits and clears a sublabel", async () => {
    const { storage } = renderWithStudium(<RequirementCard requirementId="P11" onRequestComplete={vi.fn()} />, { data: prototypes() });
    await userEvent.click(screen.getByRole("button", { name: "Edit Prototype 11" }));
    const field = screen.getByRole("textbox", { name: "Sublabel" }) as HTMLInputElement;
    expect(field.maxLength).toBe(30);
    await userEvent.type(field, "Accessibility");
    await userEvent.click(screen.getByRole("button", { name: "Save requirement" }));
    screen.getByText("Accessibility");
    expect(savedData(storage).requirements.find((r) => r.id === "P11")?.sublabel).toBe("Accessibility");

    await userEvent.click(screen.getByRole("button", { name: "Edit Prototype 11" }));
    expect((screen.getByRole("textbox", { name: "Sublabel" }) as HTMLInputElement).value).toBe("Accessibility");
    await userEvent.clear(screen.getByRole("textbox", { name: "Sublabel" }));
    await userEvent.click(screen.getByRole("button", { name: "Save requirement" }));
    expect(screen.queryByText("Accessibility")).toBeNull();
    expect("sublabel" in (savedData(storage).requirements.find((r) => r.id === "P11") ?? {})).toBe(false);
  });
});
