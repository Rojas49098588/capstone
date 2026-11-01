import { describe, expect, it } from "vitest";
import { isLightColor, textIn, textOn } from "./color";

describe("project colors", () => {
  it("tells light colors from dark ones", () => {
    expect(isLightColor("#ffeb3b")).toBe(true);
    expect(isLightColor("#ffffff")).toBe(true);
    expect(isLightColor("#2d3a8c")).toBe(false);
    expect(isLightColor("#3a7c4f")).toBe(false);
  });

  it("picks readable text on a project color", () => {
    expect(textOn("#ffeb3b")).toBe("#1a1816");
    expect(textOn("#2d3a8c")).toBe("#ffffff");
  });

  it("keeps text in a project color unless it's too light or too dark to read", () => {
    expect(textIn("#c9501a")).toBe("#c9501a");
    expect(textIn("#fff59d")).toBe("var(--color-foreground)");
    expect(textIn("#050505")).toBe("var(--color-foreground)");
    expect(textIn("not a color")).toBe("var(--color-foreground)");
  });
});
