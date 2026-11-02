import { describe, expect, it } from "vitest";
import { NOW, completed, dayKey, daysAgo, makeData, makeRequirement, makeTask } from "../planner/testData";
import { createProject } from "../store/actions";
import { buildSeed } from "../store/seed";
import { summarizeAll, summarizeProject } from "./derive";

describe("summaries", () => {
  it("summarizes every project in the example data", () => {
    const dash = summarizeAll(buildSeed(NOW), NOW);
    expect(dash.summaries.map((s) => s.project.id)).toEqual(["webDev", "appDev", "Animation", "seniorCap", "petExt"]);
    const web = dash.summaries[0];
    expect([web.tasksDone, web.tasksTotal]).toEqual([4, 8]);
    expect(dash.summaries[3].mood).toBe("Sick");
    expect(dash.total).toBeGreaterThan(0);
    expect(dash.total).toBeLessThan(1);
    expect(dash.tasksTotal).toBe(dash.summaries.reduce((n, s) => n + s.tasksTotal, 0));
  });

  it("handles a project with no requirements", () => {
    const { data, project } = createProject(
      buildSeed(NOW),
      { name: "Blank", shortName: "blank", color: "#2d3a8c", deadline: dayKey(30), description: "", petKind: "cat" },
      NOW,
    );
    const s = summarizeProject(project, data, NOW);
    expect([s.progress, s.gap, s.mood, s.tasksTotal]).toEqual([0, 0, "Happy", 0]);
  });
});

describe("summarizeProject with a snack", () => {
  it("shows the first pet's snack in the project's mood", () => {
    const ids = Array.from({ length: 10 }, (_, i) => `t${i}`);
    const data = makeData({
      requirements: [makeRequirement({ id: "r1", startDate: dayKey(-10), dueDate: dayKey(10) })],
      tasks: ids.map((id, i) => makeTask({ id, requirementId: "r1", done: i < 4 })),
      events: [
        ...ids.slice(0, 4).map((id) => completed(id, daysAgo(1), { requirementId: "r1" })),
        { type: "fed", at: new Date(NOW.getTime() - 3_600_000).toISOString(), projectId: "p1", petId: "p1", productId: "berry-bites" },
      ],
    });
    expect(summarizeProject(data.projects[0], data, NOW).mood).toBe("Happy");
  });
});
