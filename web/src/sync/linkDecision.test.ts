import { describe, expect, it } from "vitest";
import { NOW } from "../planner/testData";
import * as A from "../store/actions";
import { buildSeed, emptyData } from "../store/seed";
import { decideLink, hasOwnProjects, type LinkDecision } from "./linkDecision";
import { EMPTY_SYNC_STATE } from "./syncState";

const run = (owner: string | null, changed: boolean, local: boolean, remote: boolean): LinkDecision =>
  decideLink({ uid: "u1", state: { ...EMPTY_SYNC_STATE, owner, changedWhileSignedOut: changed }, localHasProjects: local, remoteHasProjects: remote });

describe("decideLink", () => {
  it("guest data with projects here and none in the account uploads", () => expect(run(null, false, true, false)).toBe("upload"));
  it("guest data with none here and projects in the account takes them", () => expect(run(null, false, false, true)).toBe("take"));
  it("nothing anywhere uploads", () => expect(run(null, false, false, false)).toBe("upload"));
  it("projects on both sides ask the user", () => expect(run(null, false, true, true)).toBe("picker"));
  it("this account's data, unchanged while signed out, rejoins", () => {
    for (const local of [true, false]) for (const remote of [true, false]) expect(run("u1", false, local, remote)).toBe("rejoin");
  });
  it("this account's data changed while signed out, projects on both sides, asks", () => expect(run("u1", true, true, true)).toBe("picker"));
  it("this account's data changed while signed out, nothing in the account, uploads", () => expect(run("u1", true, true, false)).toBe("upload"));
  it("this account's data changed while signed out but no local projects rejoins", () => {
    expect(run("u1", true, false, true)).toBe("rejoin");
    expect(run("u1", true, false, false)).toBe("rejoin");
  });
  it("another account's data is backed up, never uploaded or offered", () => {
    for (const changed of [true, false]) for (const local of [true, false]) for (const remote of [true, false])
      expect(run("u2", changed, local, remote)).toBe("backup-and-take");
  });
});

describe("hasOwnProjects", () => {
  const later = new Date(NOW.getTime() + 60_000);
  it("no projects: none of its own", () => expect(hasOwnProjects(emptyData(NOW))).toBe(false));
  it("the untouched example data counts as none of its own", () => expect(hasOwnProjects(buildSeed(NOW))).toBe(false));
  it("the example data with some projects deleted is still untouched", () => {
    const seed = buildSeed(NOW);
    expect(hasOwnProjects(A.deleteProject(seed, seed.projects[0].id))).toBe(false);
  });
  it("the example data with anything done since (an event after its newest) is the person's own", () => {
    const seed = buildSeed(NOW);
    const task = seed.tasks.find((t) => !t.done && !t.blockedBy.length) ?? seed.tasks[0];
    expect(hasOwnProjects(A.completeTask(seed, task.id, 30, later).data)).toBe(true);
  });
  it("a project that isn't one of the example data's is the person's own", () => {
    const made = A.createProject(buildSeed(NOW), { name: "Essay", shortName: "E", color: "#123456", deadline: "2026-12-20", description: "", petKind: "cat" }, later);
    expect(hasOwnProjects(made.data)).toBe(true);
    expect(hasOwnProjects(A.createProject(emptyData(NOW), { name: "Essay", shortName: "E", color: "#123456", deadline: "2026-12-20", description: "", petKind: "cat" }, NOW).data)).toBe(true);
  });
});
