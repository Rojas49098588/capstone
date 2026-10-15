import { describe, expect, it } from "vitest";
import { suggestNext, todayTaskIds } from "./suggest";
import { NOW, dayKey, makeData, makeRequirement, makeTask } from "./testData";

function data() {
  return makeData({
    requirements: [makeRequirement()],
    tasks: [
      makeTask({ id: "a" }), // unblocks c
      makeTask({ id: "b" }),
      makeTask({ id: "c", blockedBy: ["a"] }), // blocked
      makeTask({ id: "d", done: true }), // done
      makeTask({ id: "e", requirementId: null }), // unlinked
      makeTask({ id: "f" }), // already in today
      makeTask({ id: "g", priority: true }), // pinned
    ],
    today: { date: dayKey(0), taskIds: ["f"] },
  });
}

describe("suggestNext", () => {
  it("puts pinned tasks first, then the highest expected tokens", () => {
    expect(suggestNext(data(), NOW).map((s) => s.task.id)).toEqual(["g", "a", "b"]);
  });

  it("respects the count", () => {
    expect(suggestNext(data(), NOW, 2).map((s) => s.task.id)).toEqual(["g", "a"]);
  });

  it("ignores yesterday's today list", () => {
    const stale = { ...data(), today: { date: dayKey(-1), taskIds: ["f"] } };
    expect(todayTaskIds(stale, NOW)).toEqual([]);
    expect(suggestNext(stale, NOW).map((s) => s.task.id)).toContain("f");
  });
});
