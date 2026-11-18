// @vitest-environment jsdom
// The demo copy's save (demo stand spec): the owner's five classes with made-up work, built from "now",
// checked on several days and times so Reset looks right whenever it's pressed.
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEMO_PROJECT_IDS, DEMO_SETTINGS, buildDemo, resetDemo, startDemoIfNew } from "./demo";
import { STORAGE_KEY, isValidData, normalizeData } from "./storage";
import { SETTINGS_KEY, parseSettings } from "./settings";
import { petMood, petsOf, settlePets } from "../planner/pets";
import { viewOf } from "../planner/requirementView";
import { isReordered, listOf } from "../planner/order";
import { tokenBalance } from "../planner/history";
import { hasPlacedWindow } from "../planner/timeOfDay";
import { projectProgress } from "../planner/progress";
import { estimateMultipliers } from "../planner/learning";
import { localDateKey } from "../planner/time";

const NOWS = ["2026-12-02T10:00", "2026-12-03T09:00", "2026-12-03T23:50", "2026-12-04T00:10", "2027-02-15T14:00"];

describe.each(NOWS)("the demo save, built at %s", (when) => {
  const now = new Date(when);

  it("is a valid save that loading leaves unchanged", () => {
    const d = buildDemo(now);
    expect(isValidData(d)).toBe(true);
    expect(normalizeData(d)).toEqual(d);
    expect(settlePets(d, now).news).toEqual([]); // nothing hatches or grows up on the first load
  });

  it("has the owner's five classes with stable ids", () => {
    const d = buildDemo(now);
    expect(d.projects.map((p) => p.id)).toEqual([...DEMO_PROJECT_IDS]);
    expect(buildDemo(new Date("2027-06-01T08:00")).projects.map((p) => p.id)).toEqual([...DEMO_PROJECT_IDS]);
    expect(d.projects.map((p) => [p.name, p.shortName])).toEqual([
      ["Capstone: Studium", "Capstone"],
      ["App Dev: Mustang Closet", "App Dev"],
      ["Web Dev: Childcare website", "Web Dev"],
      ["3D Animation: Blender short", "3D Anim"],
      ["UI/UX: YouTube redesign", "UI/UX"],
    ]);
    expect(new Set(d.projects.map((p) => p.petKind))).toEqual(new Set(["cat", "dog", "frog", "pigeon", "turtle"]));
  });

  it("has pets that roam: no eggs, at least one juvenile, and one bought pet", () => {
    const d = buildDemo(now);
    const pets = d.projects.flatMap(petsOf);
    expect(pets.every((p) => p.stage !== "egg" && p.hatchedAt !== null)).toBe(true);
    expect(pets.some((p) => p.stage === "juvenile")).toBe(true);
    expect(d.projects.some((p) => (p.pets?.length ?? 0) >= 1)).toBe(true);
  });

  it("gives Web Dev the planner path", () => {
    const d = buildDemo(now);
    const reqs = d.requirements.filter((r) => r.projectId === "webDev");
    expect(reqs.map((r) => r.title)).toEqual(expect.arrayContaining(["Front end", "Back end", "Middle layer", "Deployment"]));
    const deploy = reqs.find((r) => r.title === "Deployment")!;
    const others = reqs.filter((r) => ["Front end", "Back end", "Middle layer"].includes(r.title)).map((r) => r.id);
    expect(deploy.blockedByAll === true || others.every((id) => deploy.blockedBy?.includes(id))).toBe(true);
    expect(reqs.some((r) => r.sublabel)).toBe(true);
    const soon = viewOf("webDev", d, ["soon"], now);
    expect(soon.requirements.length).toBeGreaterThanOrEqual(1);
    expect(soon.hiddenCount).toBeGreaterThanOrEqual(1);
    expect(reqs.some((r) => d.tasks.filter((t) => t.requirementId === r.id && !t.done).length >= 4)).toBe(true);
    expect(d.today.taskIds.some((id) => d.tasks.find((t) => t.id === id)?.projectId === "webDev")).toBe(true);
  });

  it("plans a believable Today", () => {
    const d = buildDemo(now);
    expect(d.today.date).toBe(localDateKey(now));
    expect(d.today.taskIds.length).toBeGreaterThanOrEqual(3);
    expect(d.today.taskIds.length).toBeLessThanOrEqual(5);
    const today = d.today.taskIds.map((id) => d.tasks.find((t) => t.id === id));
    expect(today.every((t) => t !== undefined && !t.done)).toBe(true);
    expect(new Set(today.map((t) => t?.projectId)).size).toBeGreaterThanOrEqual(2);
  });

  it("shows different moods and progress", () => {
    const d = buildDemo(now);
    const moods = d.projects.flatMap(petsOf).map((p) => petMood(p, d, now)?.mood);
    expect(moods.some((m) => m === "Proud" || m === "Delighted" || m === "Happy")).toBe(true);
    expect(moods.some((m) => m === "Worried" || m === "Upset")).toBe(true);
    expect(moods).not.toContain("Sick");
    const m = estimateMultipliers(d);
    expect(projectProgress("capstone", d, m)).toBeGreaterThanOrEqual(0.8);
    expect(d.projects.some((p) => p.id !== "capstone" && projectProgress(p.id, d, m) < 0.6)).toBe(true);
  });

  it("is ready to play: tokens, toys, decor, a star and a reordered list", () => {
    const d = buildDemo(now);
    expect(tokenBalance(d)).toBeGreaterThanOrEqual(1400);
    expect(tokenBalance(d)).toBeLessThanOrEqual(1700);
    const bought = d.events.flatMap((e) => (e.type === "purchase" ? [e.productId] : []));
    expect(bought).toEqual(expect.arrayContaining(["focus-ball", "robo-mouse", "window"]));
    expect(Object.values(d.decor ?? {}).some(hasPlacedWindow)).toBe(true);
    expect(d.tasks.some((t) => t.priority && !t.done)).toBe(true);
    expect(d.tasks.some((t) => isReordered(listOf(t, d.tasks)))).toBe(true);
  });
});

describe("the demo settings", () => {
  it("survive a save and load, with setup done and lively pets", () => {
    expect(parseSettings(JSON.stringify(DEMO_SETTINGS))).toEqual(DEMO_SETTINGS);
    expect(DEMO_SETTINGS.setupDone && DEMO_SETTINGS.tutorialDone && DEMO_SETTINGS.shopTutorialDone).toBe(true);
    expect(DEMO_SETTINGS.petCount).toBe("all");
    expect(DEMO_SETTINGS.petInvolvement).toBe("moderate");
    expect(DEMO_SETTINGS.startWithComputer).toBe(false);
  });
});

describe("demo mode", () => {
  const now = new Date("2026-12-03T09:00");
  const savedDemo = () => JSON.stringify(buildDemo(now));
  afterEach(() => {
    delete window.studiumDesktop;
    localStorage.clear();
  });

  it("starts a new demo copy with the demo save and settings", () => {
    window.studiumDesktop = { desktop: true, demo: true };
    expect(startDemoIfNew(localStorage, now)).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(savedDemo());
    expect(parseSettings(localStorage.getItem(SETTINGS_KEY))).toEqual(DEMO_SETTINGS);
  });

  it("leaves a demo copy that already has data alone", () => {
    window.studiumDesktop = { desktop: true, demo: true };
    localStorage.setItem(STORAGE_KEY, "{\"mine\":1}");
    expect(startDemoIfNew(localStorage, now)).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("{\"mine\":1}");
    expect(localStorage.getItem(SETTINGS_KEY)).toBeNull();
  });

  it("does nothing outside the demo copy", () => {
    window.studiumDesktop = { desktop: true };
    expect(startDemoIfNew(localStorage, now)).toBe(false);
    expect(startDemoIfNew(null, now)).toBe(false);
    expect(localStorage.length).toBe(0);
  });

  it("Reset replaces everything, reloads the pets, then the page", () => {
    localStorage.setItem(STORAGE_KEY, "{\"mine\":1}");
    localStorage.setItem(SETTINGS_KEY, "{}");
    const calls: string[] = [];
    resetDemo({ storage: localStorage, now, reloadPets: () => calls.push("pets"), reload: () => calls.push("page") });
    expect(localStorage.getItem(STORAGE_KEY)).toBe(savedDemo());
    expect(parseSettings(localStorage.getItem(SETTINGS_KEY))).toEqual(DEMO_SETTINGS);
    expect(calls).toEqual(["pets", "page"]);
    const reload = vi.fn();
    resetDemo({ storage: localStorage, now, reload }); // no pets' window to reload: still resets
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
