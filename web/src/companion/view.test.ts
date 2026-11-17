import { describe, expect, it } from "vitest";
import { petMood, petsOf } from "../planner/pets";
import { NOW, dayKey, daysAgo, makeData, makePet, makeProject, makeRequirement, makeTask } from "../planner/testData";
import type { StudiumData, StudiumEvent } from "../planner/types";
import { emptyData } from "../store/seed";
import { formatDate } from "../ui/format";
import { needsYou, pendingRows, petGroups, todayRows } from "./view";

const HOUR = 3_600_000;
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const stock = (productId: string): StudiumEvent => ({ type: "purchase", at: daysAgo(2), productId, price: 0 });
const meal = (at: string, projectId = "p1", petId = "p1"): StudiumEvent => ({ type: "fed", at, projectId, petId, productId: "power-bento" });

// Upset (gentle: far behind plan, not idle long enough to be sick) and Sick (strict: idle 10 days).
function moods(): StudiumData {
  return makeData({
    projects: [
      makeProject({ id: "up", name: "Essay", shortName: "ESS", difficulty: "gentle" }),
      makeProject({ id: "sk", name: "Stats", shortName: "STA", difficulty: "strict" }),
    ],
    requirements: [
      makeRequirement({ id: "ru", projectId: "up", title: "Outline", startDate: dayKey(-8), dueDate: dayKey(2) }),
      makeRequirement({ id: "rs", projectId: "sk", title: "Problem set", startDate: dayKey(-10), dueDate: dayKey(20) }),
    ],
    tasks: [makeTask({ id: "tu", projectId: "up", requirementId: "ru" }), makeTask({ id: "ts", projectId: "sk", requirementId: "rs" })],
    events: [stock("power-bento")],
  });
}

describe("petGroups", () => {
  it("groups pets by project in order, the project's own pet first, each with its own mood", () => {
    const data = makeData({
      projects: [
        makeProject({ id: "p1", name: "Capstone", shortName: "CAP", deadline: dayKey(20), pets: [makePet({ id: "x1", name: "Biscuit", kind: "dog", caresFor: "r2" })] }),
        makeProject({ id: "p2", name: "App Dev", shortName: "APP" }),
      ],
      requirements: [makeRequirement({ id: "r1" }), makeRequirement({ id: "r2", title: "User testing", startDate: dayKey(-8), dueDate: dayKey(2) })],
      tasks: [makeTask({ id: "a", requirementId: "r1" }), makeTask({ id: "b", requirementId: "r2" })],
    });
    const groups = petGroups(data, NOW);
    expect(groups.map((g) => g.heading)).toEqual([`Capstone · due ${formatDate(dayKey(20))}`, `App Dev · due ${formatDate(dayKey(30))}`]);
    const [own, biscuit] = groups[0].pets;
    expect(own).toMatchObject({ petId: "p1", name: "CAP", kind: "cat", looksAfter: "Looks after the whole project" });
    expect(biscuit).toMatchObject({ petId: "x1", name: "Biscuit", kind: "dog", looksAfter: `Looks after "User testing" · due ${formatDate(dayKey(2))}` });
    const [ownRef, biscuitRef] = petsOf(data.projects[0]);
    expect(own.mood).toBe(petMood(ownRef, data, NOW)?.mood);
    expect(biscuit.mood).toBe(petMood(biscuitRef, data, NOW)?.mood);
  });

  it("shows an egg as an egg, and a pet whose requirement is gone as looking after the whole project", () => {
    const data = makeData({
      projects: [makeProject({ id: "p1", name: "Capstone", stage: "egg", hatchedAt: null, pets: [makePet({ id: "x1", name: "Biscuit", caresFor: "gone" })] })],
    });
    const [egg, biscuit] = petGroups(data, NOW)[0].pets;
    expect(egg).toMatchObject({ kind: "egg", mood: null, food: null, looksAfter: "Hatches as you work on Capstone" });
    expect(biscuit.looksAfter).toBe("Looks after the whole project");
  });

  it("names the running meal's multiplier, and \"until midnight\" for a salad", () => {
    const salad: StudiumEvent = { type: "fed", at: ago(HOUR), projectId: "p1", petId: "p1", productId: "garden-salad" };
    expect(petGroups(makeData({ events: [salad] }), NOW)[0].pets[0].food).toBe("Meal: × 1.05 tokens until midnight");
  });

  it("says how a meal or a snack is helping", () => {
    const boost = makeData({ events: [stock("power-bento"), meal(ago(3 * HOUR))] });
    expect(petGroups(boost, NOW)[0].pets[0].food).toBe("Meal: × 1.1 tokens for 1h 0m more");
    const later = makeData({ events: [stock("power-bento"), meal(ago(5 * HOUR))] });
    expect(petGroups(later, NOW)[0].pets[0].food).toBe("Next meal tomorrow");
    const snack: StudiumEvent = { type: "fed", at: ago(HOUR), projectId: "up", petId: "up", productId: "berry-bites" };
    const lifted = { ...moods(), events: [...moods().events, stock("berry-bites"), snack] };
    expect(petGroups(lifted, NOW)[0].pets[0].food).toMatch(/^Snack: lifting mood for \d/);
  });
});

describe("needsYou", () => {
  it("lists sick pets, then upset ones, then meals, in words", () => {
    const groups = petGroups(moods(), NOW);
    expect(groups.map((g) => g.pets[0].mood)).toEqual(["Upset", "Sick"]);
    expect(needsYou(moods(), NOW)).toEqual([
      { kind: "sick", petId: "sk", text: "STA is sick: give medicine." },
      { kind: "upset", petId: "up", text: expect.stringMatching(/^ESS is upset/) },
      { kind: "meal", petId: "up", text: "ESS hasn't had a meal today: × 1.1 tokens for 4 hours." },
    ]);
  });

  it("names the idle requirement for an upset pet when there is one", () => {
    const data = { ...moods(), projects: [makeProject({ id: "up", name: "Essay", shortName: "ESS", difficulty: "gentle" })] };
    const upset = needsYou(data, NOW).find((n) => n.kind === "upset");
    expect(upset?.text).toMatch(/^ESS is upset(: it hasn't seen work on "Outline" in \d+ days)?\.$/);
  });

  it("suggests no meal for a project whose boost is running", () => {
    const data = makeData({ events: [stock("power-bento"), meal(ago(HOUR))] });
    expect(needsYou(data, NOW).filter((n) => n.kind === "meal")).toEqual([]);
  });
});

describe("today and pending", () => {
  function plan(): StudiumData {
    return makeData({
      projects: [makeProject({ id: "p1", name: "Capstone" })],
      requirements: [makeRequirement({ id: "r1", dueDate: dayKey(3) })],
      tasks: [
        makeTask({ id: "a", title: "Draft", dueDate: dayKey(5) }),
        makeTask({ id: "b", title: "Waits", blockedBy: ["a"] }),
        makeTask({ id: "c", title: "Email TA", requirementId: null, estimateMin: 0, pending: true }),
        makeTask({ id: "d", title: "Loose", requirementId: null, estimateMin: 0, pending: true }),
        makeTask({ id: "e", title: "Done already", requirementId: null, estimateMin: 0, pending: true, done: true }),
      ],
      today: { date: dayKey(0), taskIds: ["b", "a", "c"] },
    });
  }

  it("keeps today's order and marks pending, blocked and capped due dates", () => {
    const rows = todayRows(plan(), NOW);
    expect(rows.map((r) => r.taskId)).toEqual(["b", "a", "c"]);
    expect(rows[0]).toMatchObject({ blocked: true, pending: false, due: null, projectName: "Capstone" });
    expect(rows[1]).toMatchObject({ blocked: false, due: formatDate(dayKey(3)) });
    expect(rows[2]).toMatchObject({ pending: true, title: "Email TA" });
  });

  it("lists pending tasks not done and not already on today's plan", () => {
    expect(pendingRows(plan(), NOW).map((r) => r.taskId)).toEqual(["d"]);
  });

  it("gives empty lists for an account with nothing in it", () => {
    const empty = emptyData(NOW);
    expect([petGroups(empty, NOW), needsYou(empty, NOW), todayRows(empty, NOW), pendingRows(empty, NOW)]).toEqual([[], [], [], []]);
  });
});
