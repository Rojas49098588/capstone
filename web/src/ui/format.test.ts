import { describe, expect, it } from "vitest";
import { NOW, dayKey, makeRequirement, makeTask } from "../planner/testData";
import { ZERO_BREAKDOWN } from "../planner/types";
import {
  accuracyLabel,
  attentionLabel,
  deadlineLabel,
  focusedLabel,
  formatDate,
  formatMinutes,
  gapLabel,
  payoutMessage,
  weekFocusLabel,
} from "./format";

describe("format", () => {
  it("formats minutes", () => {
    expect([15, 60, 90, 480].map(formatMinutes)).toEqual(["15 min", "1 h", "1 h 30 min", "8 h"]);
  });

  it("formats dates and handles empty ones", () => {
    expect(formatDate("2026-12-01")).toBe("Dec 1, 2026");
    expect(formatDate("")).toBe("No date");
  });

  it("labels deadlines by calendar day", () => {
    expect(deadlineLabel(dayKey(3), NOW)).toBe("3 days left");
    expect(deadlineLabel(dayKey(1), NOW)).toBe("1 day left");
    expect(deadlineLabel(dayKey(0), NOW)).toBe("Due today");
    expect(deadlineLabel(dayKey(-1), NOW)).toBe("Overdue");
  });

  it("describes the schedule gap", () => {
    expect(gapLabel(4.2)).toBe("4 points ahead of plan");
    expect(gapLabel(-18.6)).toBe("19 points behind plan");
    expect(gapLabel(1)).toBe("1 point ahead of plan");
    expect(gapLabel(0.3)).toBe("On plan");
  });

  it("names the longest-idle requirement", () => {
    expect(attentionLabel([])).toBe("All requirements active");
    expect(attentionLabel([{ requirement: makeRequirement({ title: "User study" }), idleDays: 9 }])).toBe(
      "User study: 9 days idle",
    );
  });

  it("shows estimate accuracy only with enough samples", () => {
    expect(accuracyLabel("appDev", 1.42, 3)).toBe("Your appDev tasks take about 1.4× your estimates");
    expect(accuracyLabel("appDev", 1.42, 2)).toBeNull();
  });

  it("explains a payout", () => {
    const payout = { tokens: 29, breakdown: { ...ZERO_BREAKDOWN, base: 70, unblockBonus: 0.3, neglectBonus: 0.1 } };
    expect(payoutMessage(payout, makeTask())).toBe(
      "+29 tokens: unblocks work +30%, revived a neglected requirement +10%",
    );
    const zero = { tokens: 0, breakdown: { ...ZERO_BREAKDOWN } };
    expect(payoutMessage(zero, makeTask({ requirementId: null }))).toMatch(/Unlinked tasks earn no tokens/);
    expect(payoutMessage(zero, makeTask())).toMatch(/already paid/);
  });
});

describe("focus wording", () => {
  it("labels focus time", () => {
    expect(focusedLabel(45)).toBe("Focused 45 min");
    expect(weekFocusLabel(150)).toBe("Focused this week: 2 h 30 min");
  });
});
