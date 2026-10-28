import { describe, expect, it } from "vitest";
import { projectDifficulty, projectType } from "./projectKind";
import { makeProject } from "./testData";

describe("project type and difficulty", () => {
  it("an old project is School and Steady", () => {
    expect(projectType(makeProject())).toBe("school");
    expect(projectDifficulty(makeProject())).toBe("steady");
  });

  it("uses the saved values", () => {
    const p = makeProject({ type: "writing", difficulty: "strict" });
    expect(projectType(p)).toBe("writing");
    expect(projectDifficulty(p)).toBe("strict");
  });
});
