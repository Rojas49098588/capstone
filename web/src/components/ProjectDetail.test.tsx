// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NOW, dayKey } from "../planner/testData";
import { createProject } from "../store/actions";
import { buildSeed } from "../store/seed";
import { renderWithStudium, savedData, withFocus } from "../test/render";
import ProjectDetail from "./ProjectDetail";

const props = { justHatched: false, onRequestComplete: vi.fn(), onEditProject: vi.fn(), onOpenShop: vi.fn() };

describe("ProjectDetail", () => {
  it("shows the project, its requirements and its habitat", () => {
    renderWithStudium(<ProjectDetail projectId="webDev" {...props} />);
    screen.getByRole("heading", { name: "Web Development Portfolio" });
    screen.getByRole("progressbar", { name: "Overall progress" });
    screen.getByRole("article", { name: "Case studies" });
    screen.getByRole("region", { name: "webDev habitat" });
  });

  it("adds a requirement", async () => {
    const { storage } = renderWithStudium(<ProjectDetail projectId="webDev" {...props} />);
    await userEvent.click(screen.getByRole("button", { name: "+ Add requirement" }));
    await userEvent.type(screen.getByLabelText("Requirement title"), "Blog");
    await userEvent.click(screen.getByRole("button", { name: "Add requirement" }));
    screen.getByRole("article", { name: "Blog" });
    expect(savedData(storage).requirements.some((r) => r.title === "Blog" && r.projectId === "webDev")).toBe(true);
  });

  it("shows the Unlinked group after unlinking a requirement's tasks", async () => {
    renderWithStudium(<ProjectDetail projectId="webDev" {...props} />);
    await userEvent.click(screen.getByRole("button", { name: "Delete Case studies" }));
    await userEvent.click(screen.getByRole("button", { name: "Move tasks to Unlinked" }));
    screen.getByRole("region", { name: "Unlinked tasks" });
  });

  it("explains what to do in an empty project", () => {
    const { data } = createProject(
      buildSeed(NOW),
      { name: "Blank", shortName: "blank", color: "#2d3a8c", deadline: dayKey(30), description: "", petKind: "cat" },
      NOW,
    );
    const id = data.projects[data.projects.length - 1].id;
    renderWithStudium(<ProjectDetail projectId={id} {...props} />, { data });
    screen.getByText(/No requirements yet/);
  });

  it("opens the project editor", async () => {
    const onEditProject = vi.fn();
    renderWithStudium(<ProjectDetail projectId="webDev" {...props} onEditProject={onEditProject} />);
    await userEvent.click(screen.getByRole("button", { name: "Edit project" }));
    expect(onEditProject).toHaveBeenCalled();
  });
});

describe("ProjectDetail focus time", () => {
  it("shows this week's focus time", () => {
    renderWithStudium(<ProjectDetail projectId="webDev" {...props} />, { data: withFocus(150) });
    screen.getByText("Focused this week: 2 h 30 min");
  });

  it("leaves out focus time from earlier weeks", () => {
    renderWithStudium(<ProjectDetail projectId="webDev" {...props} />, {
      data: withFocus(150, "webDev-t5", new Date(NOW.getTime() - 9 * 86_400_000)),
    });
    expect(screen.queryByText(/Focused this week/)).toBeNull();
  });
});
