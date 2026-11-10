import { describe, expect, it } from "vitest";
import { decideLink, type LinkDecision } from "./linkDecision";
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
