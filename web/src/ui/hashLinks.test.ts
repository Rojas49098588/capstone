import { describe, expect, it } from "vitest";
import { parseHashLink } from "./hashLinks";

describe("parseHashLink", () => {
  it("reads project and completion links", () => {
    expect(parseHashLink("#project=webDev")).toEqual({ kind: "project", id: "webDev" });
    expect(parseHashLink("#complete=a%20b")).toEqual({ kind: "complete", id: "a b" });
  });

  it("ignores anything else", () => {
    for (const hash of ["", "#", "#project=", "#other=x", "#complete=%E0", "project=webDev"]) {
      expect(parseHashLink(hash)).toBeNull();
    }
  });
});
