// @vitest-environment jsdom
import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { dayKey, makeData, makeProject, makeRequirement, makeTask } from "../planner/testData";
import { renderWithStudium, savedData } from "../test/render";
import Overview from "./Overview";
import PendingTasks from "./PendingTasks";
import RequirementsSection from "./RequirementsSection";

const pending = (o: Parameters<typeof makeTask>[0] = {}) =>
  makeTask({ id: "pt", title: "Email TA", requirementId: null, estimateMin: 0, pending: true, ...o });

const data = () =>
  makeData({
    projects: [makeProject({ id: "p1", shortName: "CAP" }), makeProject({ id: "p2", shortName: "APP" })],
    requirements: [
      makeRequirement({ id: "r1", projectId: "p1", title: "User testing", dueDate: dayKey(10) }),
      makeRequirement({ id: "q1", projectId: "p2", title: "Other project's" }),
    ],
    tasks: [pending()],
  });

describe("PendingTasks", () => {
  it("isn't shown when nothing is pending", () => {
    renderWithStudium(<PendingTasks onSelect={vi.fn()} />, { data: makeData({ tasks: [makeTask()], requirements: [makeRequirement()] }) });
    expect(screen.queryByRole("region", { name: "Pending" })).toBeNull();
  });

  it("lists pending tasks with their project", () => {
    renderWithStudium(<PendingTasks onSelect={vi.fn()} />, { data: data() });
    const region = screen.getByRole("region", { name: "Pending" });
    within(region).getByText("Added on your phone. Add the details to start earning tokens for them.");
    within(region).getByText("Email TA");
    within(region).getByText("CAP");
  });

  it("adds the details, and the task stops being pending", async () => {
    const { storage } = renderWithStudium(<PendingTasks onSelect={vi.fn()} />, { data: data() });
    await userEvent.click(screen.getByRole("button", { name: "Add details to Email TA" }));
    const requirement = screen.getByLabelText("Requirement") as HTMLSelectElement;
    expect([...requirement.options].map((o) => o.textContent)).toEqual(["User testing"]);
    expect(screen.getByLabelText("Due date (optional)").getAttribute("max")).toBe(dayKey(10));
    await userEvent.click(screen.getByRole("radio", { name: "2 h" }));
    fireEvent.change(screen.getByLabelText("Due date (optional)"), { target: { value: dayKey(3) } });
    await userEvent.click(screen.getByRole("button", { name: "Save details" }));
    const saved = savedData(storage).tasks.find((t) => t.id === "pt");
    expect(saved).toMatchObject({ requirementId: "r1", estimateMin: 120, dueDate: dayKey(3) });
    expect(saved).not.toHaveProperty("pending");
    expect(screen.queryByRole("region", { name: "Pending" })).toBeNull();
  });

  it("asks for a requirement first when the project has none", async () => {
    const onSelect = vi.fn();
    renderWithStudium(<PendingTasks onSelect={onSelect} />, { data: { ...data(), tasks: [pending({ projectId: "p2" })], requirements: [] } });
    await userEvent.click(screen.getByRole("button", { name: "Add details to Email TA" }));
    screen.getByText(/Add a requirement to APP first\./);
    await userEvent.click(screen.getByRole("button", { name: "Open APP" }));
    expect(onSelect).toHaveBeenCalledWith("p2");
  });

  it("deletes a pending task", async () => {
    const { storage } = renderWithStudium(<PendingTasks onSelect={vi.fn()} />, { data: data() });
    await userEvent.click(screen.getByRole("button", { name: "Delete Email TA" }));
    expect(savedData(storage).tasks.find((t) => t.id === "pt")).toBeUndefined();
  });

  it("is on the overview, and pending tasks are tagged in Today and Unlinked", () => {
    const d = { ...data(), today: { date: dayKey(0), taskIds: ["pt"] } };
    renderWithStudium(<Overview onSelect={vi.fn()} onRequestComplete={vi.fn()} />, { data: d });
    screen.getByRole("region", { name: "Pending" });
    within(screen.getByRole("region", { name: "Today" })).getByText("Pending");
  });

  it("tags pending tasks in a project's Unlinked list", () => {
    renderWithStudium(<RequirementsSection projectId="p1" onRequestComplete={vi.fn()} onHatch={vi.fn()} />, { data: data() });
    within(screen.getByRole("region", { name: "Unlinked tasks" })).getByText("Pending");
  });
});
