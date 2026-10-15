import { describe, expect, it } from "vitest";
import { NOW, dayKey } from "../planner/testData";
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
