// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { makeRequirement, makeTask } from "../planner/testData";
import "../test/render";
import TaskForm from "./TaskForm";

const requirements = [makeRequirement({ id: "r1", title: "Rigging" }), makeRequirement({ id: "r2", title: "Render" })];
const projectTasks = [makeTask({ id: "A", title: "Rig" }), makeTask({ id: "B", title: "Paint", blockedBy: ["A"] })];

describe("TaskForm", () => {
  it("asks for a title", async () => {
    const onSubmit = vi.fn();
    render(<TaskForm requirements={requirements} projectTasks={projectTasks} submitLabel="Add task" onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: "Add task" }));
    expect(onSubmit).not.toHaveBeenCalled();
    screen.getByText("Give the task a title.");
  });

  it("submits title, requirement, estimate and blockers", async () => {
    const onSubmit = vi.fn();
    render(<TaskForm requirements={requirements} projectTasks={projectTasks} submitLabel="Add task" onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText("Task title"), "Weight paint");
    await userEvent.selectOptions(screen.getByLabelText("Requirement"), "r2");
    await userEvent.click(screen.getByRole("radio", { name: "2 h" }));
    await userEvent.click(screen.getByLabelText("Rig"));
    await userEvent.click(screen.getByRole("button", { name: "Add task" }));
    expect(onSubmit).toHaveBeenCalledWith({ title: "Weight paint", requirementId: "r2", estimateMin: 120, blockedBy: ["A"] });
  });

  it("can leave a task unlinked", async () => {
    const onSubmit = vi.fn();
    render(<TaskForm requirements={requirements} projectTasks={[]} submitLabel="Add task" onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText("Task title"), "Loose end");
    await userEvent.selectOptions(screen.getByLabelText("Requirement"), "");
    await userEvent.click(screen.getByRole("button", { name: "Add task" }));
    expect(onSubmit.mock.calls[0][0].requirementId).toBeNull();
  });

  it("doesn't offer blockers that would make a loop", () => {
    render(
      <TaskForm
        requirements={requirements}
        projectTasks={projectTasks}
        taskId="A"
        initial={{ title: "Rig", requirementId: "r1" }}
        submitLabel="Save task"
        onSubmit={() => {}}
      />,
    );
    expect(screen.queryByLabelText("Paint")).toBeNull();
  });

  it("groups Blocked by choices under their requirement", () => {
    const requirements = [makeRequirement({ id: "P9", title: "Prototype 9" }), makeRequirement({ id: "P10", title: "Prototype 10" }), makeRequirement({ id: "E", title: "Empty" })];
    const projectTasks = [
      makeTask({ id: "c10", requirementId: "P10", title: "Git commit" }),
      makeTask({ id: "c9", requirementId: "P9", title: "Git commit" }),
      makeTask({ id: "u", requirementId: null, title: "Loose end" }),
    ];
    render(<TaskForm requirements={requirements} projectTasks={projectTasks} submitLabel="Add task" onSubmit={vi.fn()} />);
    const groups = screen.getAllByRole("group").filter((g) => g.closest("fieldset")?.parentElement?.closest("fieldset"));
    expect(groups.map((g) => g.querySelector("legend")?.textContent)).toEqual(["Prototype 9", "Prototype 10", "Unlinked"]);
    within(screen.getByRole("group", { name: "Prototype 9" })).getByRole("checkbox", { name: "Git commit" });
    within(screen.getByRole("group", { name: "Prototype 10" })).getByRole("checkbox", { name: "Git commit" });
    within(screen.getByRole("group", { name: "Unlinked" })).getByRole("checkbox", { name: "Loose end" });
    expect(screen.queryByRole("group", { name: "Empty" })).toBeNull();
  });
});
