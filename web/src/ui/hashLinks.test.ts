import { describe, expect, it } from "vitest";
import { parseHashLink } from "./hashLinks";

describe("parseHashLink", () => {
  it("reads project and completion links", () => {
    expect(parseHashLink("#project=webDev")).toEqual({ kind: "project", id: "webDev" });
    expect(parseHashLink("#complete=a%20b")).toEqual({ kind: "complete", id: "a b" });
  });

  it("reads the pet of a project link", () => {
    expect(parseHashLink("#project=p1&pet=x1")).toEqual({ kind: "project", id: "p1", pet: "x1" });
    expect(parseHashLink("#project=p%201&pet=x%201")).toEqual({ kind: "project", id: "p 1", pet: "x 1" });
    expect(parseHashLink("#project=p1&pet=")).toEqual({ kind: "project", id: "p1" });
  });

  it("ignores anything else", () => {
    for (const hash of ["", "#", "#project=", "#other=x", "#complete=%E0", "project=webDev"]) {
      expect(parseHashLink(hash)).toBeNull();
    }
  });
});
