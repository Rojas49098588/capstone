import { describe, expect, it } from "vitest";
import { dropIndex } from "./reorder";

describe("dropIndex", () => {
  it("drops before the first row whose middle is below the pointer, allowing for the dragged row", () => {
    expect(dropIndex(5, [10, 30, 50], 2)).toBe(0);
    expect(dropIndex(45, [10, 30, 50], 0)).toBe(1);
    expect(dropIndex(99, [10, 30, 50], 0)).toBe(2);
    expect(dropIndex(35, [10, 30, 50], 1)).toBe(1); // stays put
    expect(dropIndex(-50, [10, 30, 50], 0)).toBe(0);
  });
});
