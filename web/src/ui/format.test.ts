import { describe, expect, it } from "vitest";
import { NOW, dayKey, makeRequirement, makeTask } from "../planner/testData";
import { ZERO_BREAKDOWN } from "../planner/types";
import {
  projectsHeading,
  projectWords,
  hatchHint as hatchHintFor,
  EGG_LABEL,
  hatchHint,
  hatchingMessage,
  accuracyLabel,
  attentionLabel,
  awayLabel,
  copiesLabel,
  deadlineLabel,
  focusedLabel,
  formatDate,
  formatMinutes,
  gapLabel,
  parsePetAway,
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

describe("away pets", () => {
  const minutes = (n: number) => new Date(NOW.getTime() + n * 60_000);

  it("reads the extension's data-pet-away attribute", () => {
    expect(parsePetAway(`nap:${minutes(12).toISOString()}`)).toEqual({ kind: "nap", until: minutes(12) });
    expect(parsePetAway(`sleep:${minutes(60).toISOString()}`)?.kind).toBe("sleep");
    for (const bad of ["nap:nope", `dance:${minutes(1).toISOString()}`, "", null]) expect(parsePetAway(bad)).toBeNull();
  });

  it("says when a napping pet comes back", () => {
    expect(awayLabel({ kind: "nap", until: minutes(12) }, NOW)).toEqual({ title: "is napping", detail: "back in 12 min" });
    expect(awayLabel({ kind: "nap", until: new Date(NOW.getTime() + 10_000) }, NOW).detail).toBe("back in 1 min");
    expect(awayLabel({ kind: "nap", until: minutes(-5) }, NOW).detail).toBe("back in 1 min");
  });

  it("says what time a sleeping pet comes back", () => {
    expect(awayLabel({ kind: "sleep", until: new Date(2026, 9, 14, 16, 30) }, NOW)).toEqual({
      title: "is sleeping",
      detail: "back at 4:30 PM",
    });
  });
});

describe("copiesLabel", () => {
  it("says where the copies of an item are", () => {
    expect(copiesLabel(1, [{ shortName: "appDev", count: 1 }], 1)).toBe("1 here · 1 in appDev · 1 free");
    expect(copiesLabel(0, [], 2)).toBe("2 free");
    expect(copiesLabel(2, [], 0)).toBe("2 here");
    expect(copiesLabel(0, [{ shortName: "a", count: 1 }, { shortName: "b", count: 2 }], 0)).toBe("1 in a · 2 in b");
    expect(copiesLabel(0, [], 0)).toBe("none");
  });
});

describe("pet lifecycle wording", () => {
  it("counts down the requirements an egg needs", () => {
    expect(hatchHint(1)).toBe("Add 1 more requirement to hatch");
    expect(hatchHint(2)).toBe("Add 2 more requirements to hatch");
  });

  it("announces the hatch with the project's short name", () => {
    expect(hatchingMessage("webDev")).toBe("webDev is hatching!");
    expect(EGG_LABEL).toBe("Egg");
  });
});

describe("projectsHeading", () => {
  it("uses the nickname when there is one", () => {
    expect(projectsHeading("")).toBe("Your Projects");
    expect(projectsHeading("   ")).toBe("Your Projects");
    expect(projectsHeading("Abby")).toBe("Abby's Projects");
    expect(projectsHeading("Chris")).toBe("Chris's Projects");
  });
});

describe("project words in the habitat", () => {
  it("attention and accuracy use the project's words", () => {
    expect(attentionLabel([], projectWords("writing"))).toBe("All chapters active");
    expect(accuracyLabel("novel", 1.42, 3, projectWords("writing"))).toBe("Your novel scenes take about 1.4× your estimates");
  });
});

describe("projectWords", () => {
  it("every type has its words", () => {
    expect(projectWords("school")).toEqual({ requirement: "requirement", requirements: "requirements", task: "task", tasks: "tasks" });
    expect(projectWords("writing")).toEqual({ requirement: "chapter", requirements: "chapters", task: "scene", tasks: "scenes" });
    expect(projectWords("art")).toEqual({ requirement: "piece", requirements: "pieces", task: "step", tasks: "steps" });
    expect(projectWords("code")).toEqual({ requirement: "feature", requirements: "features", task: "task", tasks: "tasks" });
    expect(projectWords("music")).toEqual({ requirement: "track", requirements: "tracks", task: "task", tasks: "tasks" });
    expect(projectWords("other")).toEqual({ requirement: "milestone", requirements: "milestones", task: "task", tasks: "tasks" });
  });

  it("the hatch hint uses the project's words", () => {
    expect(hatchHintFor(2, projectWords("writing"))).toBe("Add 2 more chapters to hatch");
    expect(hatchHintFor(1, projectWords("writing"))).toBe("Add 1 more chapter to hatch");
    expect(hatchHintFor(2)).toBe("Add 2 more requirements to hatch");
  });
});
