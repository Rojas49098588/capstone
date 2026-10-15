import { describe, expect, it } from "vitest";
import { estimateMultipliers, multiplierFor, samplesFor } from "./learning";
import { completed, daysAgo, makeTask } from "./testData";
import type { Task } from "./types";

function doneTasks(n: number, estimate: number, actual: number, projectId = "p1", ageOffset = 0) {
  const tasks: Task[] = [];
  const events = [];
  for (let i = 0; i < n; i++) {
    const id = `${projectId}-${ageOffset + i}`;
    tasks.push(makeTask({ id, projectId, estimateMin: estimate, done: true, actualMin: actual }));
    events.push(completed(id, daysAgo(ageOffset + i + 1)));
  }
  return { tasks, events };
}

describe("estimateMultipliers", () => {
  it("is 1.0 with no samples", () => {
    const m = estimateMultipliers({ tasks: [], events: [] });
    expect(m.overall).toBe(1);
    expect(multiplierFor(m, "p1")).toBe(1);
    expect(samplesFor(m, "p1")).toBe(0);
  });

  it("leans toward 1.0 with one sample", () => {
    const m = estimateMultipliers(doneTasks(1, 60, 120));
    expect(m.overall).toBeCloseTo(420 / 360, 4); // (120 + 5*60) / (60 + 5*60)
    expect(multiplierFor(m, "p1")).toBeCloseTo((2 + 5 * (420 / 360)) / 6, 4);
  });

  it("approaches the real ratio with many samples", () => {
    const m = estimateMultipliers(doneTasks(20, 60, 120));
    expect(m.overall).toBeCloseTo(1.8, 4);
    expect(multiplierFor(m, "p1")).toBeCloseTo(1.96, 4);
  });

  it("is clamped to [0.5, 3]", () => {
    expect(multiplierFor(estimateMultipliers(doneTasks(20, 60, 600)), "p1")).toBe(3);
    expect(multiplierFor(estimateMultipliers(doneTasks(20, 60, 6)), "p1")).toBe(0.5);
  });

  it("uses only the newest 20 samples per project", () => {
    const recent = doneTasks(20, 60, 60, "p1", 0); // ratio 1, newest
    const old = doneTasks(5, 60, 300, "p1", 100); // ratio 5, older
    const m = estimateMultipliers({ tasks: [...recent.tasks, ...old.tasks], events: [...recent.events, ...old.events] });
    expect(multiplierFor(m, "p1")).toBeCloseTo(1, 4);
  });

  it("ignores open tasks and tasks without an actual time", () => {
    const tasks = [makeTask({ id: "a", done: false, actualMin: 500 }), makeTask({ id: "b", done: true, actualMin: null })];
    expect(estimateMultipliers({ tasks, events: [] }).overall).toBe(1);
  });

  it("falls back to the overall multiplier for a project with no samples", () => {
    const m = estimateMultipliers(doneTasks(20, 60, 120, "p1"));
    expect(multiplierFor(m, "p2")).toBe(m.overall);
  });
});
