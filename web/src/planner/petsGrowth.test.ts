import { describe, expect, it } from "vitest";
import { reached, settlePets, workSince } from "./pets";
import { NOW, completed, daysAgo, makeData, makePet, makeProject, makeRequirement, makeTask } from "./testData";
import type { StudiumData, StudiumEvent, Task } from "./types";

const task = (id: string, o: Partial<Task> = {}) => makeTask({ id, ...o });
const doneAt = (id: string, at: string, requirementId = "r1") => completed(id, at, { requirementId });
const reopened = (id: string, at: string): StudiumEvent => ({ type: "task_reopened", at, taskId: id });

describe("workSince", () => {
  it("counts tasks first completed after the moment, out of those still open then", () => {
    const events = [doneAt("a", daysAgo(3)), doneAt("b", daysAgo(1))];
    expect(workSince(["a", "b", "c", "d"], events, daysAgo(2))).toEqual({ done: 1, total: 3 });
  });

  it("counts only a task's first completion", () => {
    const events = [doneAt("a", daysAgo(3)), reopened("a", daysAgo(2.5)), doneAt("a", daysAgo(1))];
    expect(workSince(["a", "b"], events, daysAgo(2))).toEqual({ done: 0, total: 1 });
  });
});

describe("reached", () => {
  it("needs at least one task done", () => {
    expect(reached({ done: 0, total: 0 }, 0.5)).toBe(false);
    expect(reached({ done: 1, total: 2 }, 0.5)).toBe(true);
    expect(reached({ done: 1, total: 3 }, 0.5)).toBe(false);
  });
});

describe("settlePets: growing up", () => {
  const juvenile = (o: Partial<StudiumData> = {}) =>
    makeData({
      projects: [makeProject({ stage: "juvenile", hatchedAt: daysAgo(2) })],
      requirements: [makeRequirement({ id: "r1" })],
      tasks: ["a", "b", "c", "d"].map((id) => task(id)),
      ...o,
    });
  const withDone = (data: StudiumData, ids: string[], requirementId = "r1") => ({
    ...data,
    tasks: data.tasks.map((t) => (ids.includes(t.id) ? { ...t, done: true } : t)),
    events: ids.map((id) => doneAt(id, daysAgo(1), requirementId)),
  });

  it("waits until half the tasks open at hatching are done", () => {
    const one = withDone(juvenile(), ["a"]);
    expect(settlePets(one, NOW).data).toBe(one);
  });

  it("grows up at half, with news", () => {
    const r = settlePets(withDone(juvenile(), ["a", "b"]), NOW);
    expect(r.data.projects[0].stage).toBe("adult");
    expect(r.news).toEqual([{ kind: "grewUp", projectId: "p1", habitatId: "p1" }]);
  });

  it("never grows up with no tasks at all", () => {
    const empty = juvenile({ tasks: [] });
    expect(settlePets(empty, NOW).data).toBe(empty);
  });

  it("counts tasks added since hatching", () => {
    const data = juvenile({
      tasks: [
        task("a", { createdAt: daysAgo(5) }),
        task("b", { createdAt: daysAgo(5) }),
        task("c", { createdAt: daysAgo(1) }),
        task("d", { createdAt: daysAgo(1) }),
      ],
    });
    expect(settlePets(withDone(data, ["a"]), NOW).data.projects[0].stage).toBe("juvenile");
  });

  it("doesn't count tasks done before hatching", () => {
    const data = juvenile();
    const early = {
      ...data,
      tasks: data.tasks.map((t) => (["a", "b"].includes(t.id) ? { ...t, done: true } : t)),
      events: [doneAt("a", daysAgo(3)), doneAt("b", daysAgo(3))],
    };
    expect(settlePets(early, NOW).data).toBe(early);
  });

  it("never turns an adult back", () => {
    const adult = juvenile({ projects: [makeProject({ stage: "adult", hatchedAt: daysAgo(2) })] });
    expect(settlePets(adult, NOW).data).toBe(adult);
  });

  it("never hatches the first pet's egg (it hatches by requirements)", () => {
    const egg = withDone(juvenile({ projects: [makeProject({ stage: "egg", hatchedAt: null })] }), ["a", "b", "c"]);
    expect(settlePets(egg, NOW).data).toBe(egg);
  });

  it("grows a bought pet that looks after a requirement from that requirement alone", () => {
    const data = juvenile({
      projects: [makeProject({ stage: "adult", pets: [makePet({ id: "x1", hatchedAt: daysAgo(2), caresFor: "r2" })] })],
      requirements: [makeRequirement({ id: "r1" }), makeRequirement({ id: "r2" })],
      tasks: [task("a"), task("b"), task("c"), task("e", { requirementId: "r2" }), task("f", { requirementId: "r2" }), task("g", { requirementId: "r2" })],
    });
    expect(settlePets(withDone(data, ["a", "b", "c"]), NOW).data.projects[0].pets?.[0].stage).toBe("juvenile");
    const grown = settlePets(withDone(data, ["e", "f"], "r2"), NOW);
    expect(grown.data.projects[0].pets?.[0].stage).toBe("adult");
    expect(grown.news).toEqual([{ kind: "grewUp", projectId: "p1", habitatId: "x1" }]);
  });
});

describe("settlePets: finishing a looked-after requirement", () => {
  it("grows the pet up from its requirement, then sends it back to sharing", () => {
    const data = makeData({
      projects: [makeProject({ stage: "adult", pets: [makePet({ id: "x1", hatchedAt: daysAgo(2), caresFor: "r2" })] })],
      requirements: [makeRequirement({ id: "r1" }), makeRequirement({ id: "r2" })],
      tasks: [...["a", "b", "c", "d"].map((id) => task(id)), task("e", { requirementId: "r2", done: true })],
      events: [doneAt("e", daysAgo(1), "r2")],
    });
    const r = settlePets(data, NOW);
    expect(r.data.projects[0].pets?.[0]).toMatchObject({ stage: "adult", caresFor: null });
    expect(r.news).toEqual([{ kind: "grewUp", projectId: "p1", habitatId: "x1" }]);
  });
});

describe("settlePets: bought eggs", () => {
  const withEgg = (tasks: Task[], events: StudiumEvent[]) =>
    makeData({
      projects: [makeProject({ stage: "adult", pets: [makePet({ id: "x1", stage: "egg", boughtAt: daysAgo(2), hatchedAt: null, name: null })] })],
      requirements: [makeRequirement({ id: "rA" }), makeRequirement({ id: "rB" })],
      tasks,
      events,
    });

  it("hatches when one requirement is half done since the purchase", () => {
    const tasks = ["a1", "a2", "a3", "a4"].map((id, i) => task(id, { requirementId: "rA", done: i < 2 }));
    const r = settlePets(withEgg(tasks, [doneAt("a1", daysAgo(1), "rA"), doneAt("a2", daysAgo(1), "rA")]), NOW);
    expect(r.data.projects[0].pets?.[0]).toMatchObject({ stage: "juvenile", hatchedAt: NOW.toISOString(), name: null });
    expect(r.news).toEqual([{ kind: "hatched", projectId: "p1", habitatId: "x1" }]);
  });

  it("doesn't count work from before the purchase", () => {
    const tasks = [task("b1", { requirementId: "rB", done: true }), task("b2", { requirementId: "rB", done: true }), task("a1", { requirementId: "rA" })];
    const data = withEgg(tasks, [doneAt("b1", daysAgo(3), "rB"), doneAt("b2", daysAgo(3), "rB")]);
    expect(settlePets(data, NOW).data).toBe(data);
  });

  it("doesn't add up work across requirements", () => {
    const tasks = [
      task("a1", { requirementId: "rA", done: true }),
      task("a2", { requirementId: "rA" }),
      task("a3", { requirementId: "rA" }),
      task("b1", { requirementId: "rB", done: true }),
      task("b2", { requirementId: "rB" }),
      task("b3", { requirementId: "rB" }),
    ];
    const data = withEgg(tasks, [doneAt("a1", daysAgo(1), "rA"), doneAt("b1", daysAgo(1), "rB")]);
    expect(settlePets(data, NOW).data).toBe(data);
  });

  it("hatches when a requirement is finished with work since the purchase", () => {
    const tasks = ["a1", "a2", "a3"].map((id) => task(id, { requirementId: "rA", done: true }));
    const events = [
      doneAt("a1", daysAgo(3), "rA"),
      doneAt("a2", daysAgo(3), "rA"),
      reopened("a2", daysAgo(2.5)),
      doneAt("a2", daysAgo(1.5), "rA"),
      doneAt("a3", daysAgo(1), "rA"),
    ];
    expect(settlePets(withEgg(tasks, events), NOW).data.projects[0].pets?.[0].stage).toBe("juvenile");
  });
});

describe("settlePets: what a pet cares about", () => {
  const caring = (o: Partial<StudiumData>) =>
    makeData({ projects: [makeProject({ stage: "adult", pets: [makePet({ id: "x1", stage: "adult", caresFor: "r2" })] })], ...o });

  it("goes back to sharing when its requirement is finished", () => {
    const data = caring({
      requirements: [makeRequirement({ id: "r2" })],
      tasks: [task("e", { requirementId: "r2", done: true })],
      events: [doneAt("e", daysAgo(10), "r2")],
    });
    expect(settlePets(data, NOW).data.projects[0].pets?.[0].caresFor).toBeNull();
  });

  it("goes back to sharing when its requirement is gone", () => {
    expect(settlePets(caring({ requirements: [] }), NOW).data.projects[0].pets?.[0].caresFor).toBeNull();
  });

  it("keeps an unfinished requirement", () => {
    const data = caring({ requirements: [makeRequirement({ id: "r2" })], tasks: [task("e", { requirementId: "r2" })] });
    expect(settlePets(data, NOW).data).toBe(data);
  });
});
