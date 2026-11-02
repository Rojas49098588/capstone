// @vitest-environment jsdom
import { act, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NOW, completed, dayKey, daysAgo, makeData, makePet, makeProject, makeRequirement, makeTask } from "../planner/testData";
import { buildSeed } from "../store/seed";
import { WAKE_PET_EVENT } from "../store/petStatus";
import type { ExtraPet, StudiumData, StudiumEvent } from "../planner/types";
import { buyEgg, placeDecor } from "../store/actions";
import { renderWithStudium, savedData, withEgg } from "../test/render";
import Habitat, { HABITAT_FALLBACK_MS } from "./Habitat";

afterEach(() => vi.useRealTimers());

describe("Habitat", () => {
  it("marks the box for the extension and shows a still picture if no pet arrives", () => {
    vi.useFakeTimers();
    renderWithStudium(<Habitat habitatId="webDev" onOpenShop={vi.fn()} />);
    expect(document.querySelector('[data-pet-habitat="webDev"]')).not.toBeNull();
    expect(screen.queryByRole("img", { name: /pigeon/ })).toBeNull();
    act(() => {
      vi.advanceTimersByTime(HABITAT_FALLBACK_MS);
    });
    screen.getByRole("img", { name: "webDev's pigeon" });
  });

  it("shows no still picture when the extension attaches a pet", () => {
    vi.useFakeTimers();
    renderWithStudium(<Habitat habitatId="webDev" onOpenShop={vi.fn()} />);
    document.querySelector('[data-pet-habitat="webDev"]')?.setAttribute("data-pet-attached", "");
    act(() => {
      vi.advanceTimersByTime(HABITAT_FALLBACK_MS);
    });
    expect(screen.queryByRole("img", { name: /pigeon/ })).toBeNull();
  });

  it("shows mood, plan gap, attention and estimate accuracy", () => {
    renderWithStudium(<Habitat habitatId="seniorCap" onOpenShop={vi.fn()} />);
    expect(screen.getAllByText("Sick").length).toBeGreaterThan(0);
    screen.getByText(/points? behind plan|On plan/);
    screen.getByText("Prototype v1: 16 days idle");
    screen.getByText(/Your seniorCap tasks take about/);
  });

  it("hides estimate accuracy until there are enough timed tasks", () => {
    const data = buildSeed(NOW);
    data.tasks = data.tasks.map((t) => (t.projectId === "webDev" ? { ...t, actualMin: null } : t));
    renderWithStudium(<Habitat habitatId="webDev" onOpenShop={vi.fn()} />, { data });
    screen.getByText(/Finish a few tasks with a time/);
  });

  it("sends you to the shop when a sick pet needs medicine you don't have", async () => {
    const onOpenShop = vi.fn();
    renderWithStudium(<Habitat habitatId="seniorCap" onOpenShop={onOpenShop} />);
    await userEvent.click(screen.getByRole("button", { name: "Buy medicine in the Shop" }));
    expect(onOpenShop).toHaveBeenCalled();
  });

  it("leaves giving medicine to the inventory", () => {
    const data = buildSeed(NOW);
    data.events.push({ type: "purchase", at: NOW.toISOString(), productId: "medicine", price: 80 });
    renderWithStudium(<Habitat habitatId="seniorCap" onOpenShop={vi.fn()} />, { data });
    expect(screen.queryByRole("button", { name: /Give medicine/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Buy medicine in the Shop" })).toBeNull();
  });

  it("brings the still picture back when the extension lets go of the box", async () => {
    vi.useFakeTimers();
    renderWithStudium(<Habitat habitatId="webDev" onOpenShop={vi.fn()} />);
    const box = document.querySelector('[data-pet-habitat="webDev"]') as HTMLElement;
    box.setAttribute("data-pet-attached", "");
    act(() => {
      vi.advanceTimersByTime(HABITAT_FALLBACK_MS);
    });
    expect(screen.queryByRole("img", { name: /pigeon/ })).toBeNull();
    await act(async () => {
      box.removeAttribute("data-pet-attached");
    });
    screen.getByRole("img", { name: "webDev's pigeon" });
  });
});

describe("Habitat while the pet is away", () => {
  const box = () => document.querySelector('[data-pet-habitat="webDev"]') as HTMLElement;
  // The box's MutationObserver reports after a microtask, so let it run inside act.
  const setAway = (value: string | null) =>
    act(async () => {
      if (value === null) box().removeAttribute("data-pet-away");
      else box().setAttribute("data-pet-away", value);
    });
  const inMinutes = (n: number) => new Date(NOW.getTime() + n * 60_000).toISOString();

  it("shows that the pet is napping, with a Wake button", async () => {
    renderWithStudium(<Habitat habitatId="webDev" onOpenShop={vi.fn()} />);
    await setAway(`nap:${inMinutes(12)}`);
    screen.getByText("webDev is napping");
    screen.getByText(/back in 12 min/);
    const onWake = vi.fn();
    window.addEventListener(WAKE_PET_EVENT, onWake);
    await userEvent.click(screen.getByRole("button", { name: "Wake" }));
    window.removeEventListener(WAKE_PET_EVENT, onWake);
    expect((onWake.mock.calls[0][0] as CustomEvent).detail).toBe("webDev");
  });

  it("shows sleeping with the return time", async () => {
    renderWithStudium(<Habitat habitatId="webDev" onOpenShop={vi.fn()} />);
    await setAway(`sleep:${new Date(2026, 9, 14, 13, 30).toISOString()}`);
    screen.getByText("webDev is sleeping");
    screen.getByText(/back at 1:30 PM/);
  });

  it("goes back to normal when the attribute is removed", async () => {
    renderWithStudium(<Habitat habitatId="webDev" onOpenShop={vi.fn()} />);
    await setAway(`nap:${inMinutes(12)}`);
    await setAway(null);
    expect(screen.queryByText(/is napping/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Wake" })).toBeNull();
  });

  it("shows the still picture with the napping line when no pet is attached", async () => {
    vi.useFakeTimers();
    renderWithStudium(<Habitat habitatId="webDev" onOpenShop={vi.fn()} />);
    await setAway(`nap:${inMinutes(12)}`);
    act(() => {
      vi.advanceTimersByTime(HABITAT_FALLBACK_MS);
    });
    screen.getByRole("img", { name: "webDev's pigeon" });
    screen.getByText("webDev is napping");
  });
});

describe("Habitat decor", () => {
  const owning = (...ids: string[]) => {
    const data = buildSeed(NOW);
    for (const productId of ids) data.events.push({ type: "purchase", at: NOW.toISOString(), productId, price: 0 });
    return data;
  };

  it("draws placed decor", () => {
    let data = placeDecor(owning("oak-planks", "pet-bed"), "webDev", "flooring", "oak-planks");
    data = placeDecor(data, "webDev", "floorMiddle", "pet-bed");
    renderWithStudium(<Habitat habitatId="webDev" onOpenShop={vi.fn()} />, { data });
    screen.getByRole("img", { name: "Pet Bed" });
    const floor = document.querySelector('[data-decor-layer="flooring"]') as HTMLElement;
    expect(floor.style.backgroundImage).toContain("decor/oak-planks.svg");
    expect(document.querySelector('[data-decor-layer="wallpaper"]')).toBeNull(); // Plain
    expect(screen.queryAllByRole("button", { name: /^Put / })).toHaveLength(0); // not placing
  });

  it("outlines the free slots while placing", async () => {
    const data = placeDecor(owning("pet-bed", "clock"), "webDev", "floorMiddle", "pet-bed");
    const onPickSlot = vi.fn();
    renderWithStudium(
      <Habitat habitatId="webDev" onOpenShop={vi.fn()} placing={{ itemId: "clock" }} onPickSlot={onPickSlot} />,
      { data },
    );
    expect(screen.getAllByRole("button", { name: /^Put Clock in/ }).map((b) => b.getAttribute("aria-label"))).toEqual([
      "Put Clock in the left wall spot",
      "Put Clock in the right wall spot",
    ]);
    await userEvent.click(screen.getByRole("button", { name: "Put Clock in the right wall spot" }));
    expect(onPickSlot).toHaveBeenCalledWith("wallRight");
  });

  it("skips taken slots and slots that would break the rules", () => {
    const data = placeDecor(owning("pet-bed", "pet-bed"), "webDev", "floorMiddle", "pet-bed");
    renderWithStudium(
      <Habitat habitatId="webDev" onOpenShop={vi.fn()} placing={{ itemId: "pet-bed" }} onPickSlot={vi.fn()} />,
      { data },
    );
    expect(screen.queryAllByRole("button", { name: /^Put Pet Bed/ })).toHaveLength(0); // one bed per habitat
  });

  it("hides an item whose image fails to load", () => {
    const data = placeDecor(owning("pet-bed"), "webDev", "floorMiddle", "pet-bed");
    renderWithStudium(<Habitat habitatId="webDev" onOpenShop={vi.fn()} />, { data });
    fireEvent.error(screen.getByRole("img", { name: "Pet Bed" }));
    expect(screen.queryByRole("img", { name: "Pet Bed" })).toBeNull();
  });
});

describe("Habitat pet stages", () => {
  it("an Art egg asks for more pieces", () => {
    const { data, id } = withEgg(1);
    data.projects = data.projects.map((p) => (p.id === id ? { ...p, type: "art" as const } : p));
    renderWithStudium(<Habitat habitatId={id} onOpenShop={vi.fn()} />, { data });
    screen.getByText("Add 2 more pieces to hatch");
  });

  it("shows the egg straight away, with how many requirements it needs to hatch", () => {
    vi.useFakeTimers();
    const { data, id } = withEgg(1);
    renderWithStudium(<Habitat habitatId={id} onOpenShop={vi.fn()} />, { data });
    screen.getByRole("img", { name: "novel's egg" });
    screen.getByText("Add 2 more requirements to hatch");
    expect(screen.queryByText("Mood")).toBeNull();
    expect(screen.queryByText(/ahead of plan|behind plan|On plan/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Buy medicine in the Shop" })).toBeNull();
    act(() => {
      vi.advanceTimersByTime(HABITAT_FALLBACK_MS);
    });
    expect(screen.queryByRole("img", { name: "novel's cat" })).toBeNull();
  });

  it("shows a juvenile's still picture at 75% size", () => {
    vi.useFakeTimers();
    const { data, id } = withEgg(3);
    renderWithStudium(<Habitat habitatId={id} onOpenShop={vi.fn()} />, { data });
    expect(screen.queryByRole("img", { name: "novel's egg" })).toBeNull();
    act(() => {
      vi.advanceTimersByTime(HABITAT_FALLBACK_MS);
    });
    expect(screen.getByRole("img", { name: "novel's cat" }).style.height).toBe("72px");
  });
});

describe("Habitat pictures and decor placing", () => {
  it("lets clicks through the egg to the floor spots", () => {
    const { data, id } = withEgg(1);
    renderWithStudium(<Habitat habitatId={id} onOpenShop={vi.fn()} />, { data });
    expect(screen.getByRole("img", { name: "novel's egg" }).className).toContain("pointer-events-none");
  });

  it("lets clicks through the still picture to the floor spots", () => {
    vi.useFakeTimers();
    renderWithStudium(<Habitat habitatId="webDev" onOpenShop={vi.fn()} />);
    act(() => {
      vi.advanceTimersByTime(HABITAT_FALLBACK_MS);
    });
    expect(screen.getByRole("img", { name: "webDev's pigeon" }).className).toContain("pointer-events-none");
  });
});

describe("Habitats of bought pets", () => {
  /** The example data with a frog egg bought for `projectId`, changed by `pet`. */
  function withBought(projectId: string, pet: Partial<ExtraPet> = {}): { data: StudiumData; id: string } {
    const r = buyEgg(buildSeed(NOW), projectId, "frog", NOW);
    const id = r.habitatId as string;
    const data = { ...r.data, projects: r.data.projects.map((p) => (p.id === projectId ? { ...p, pets: p.pets?.map((x) => ({ ...x, ...pet })) } : p)) };
    return { data, id };
  }
  const requirementId = (data: StudiumData, title: string) => data.requirements.find((r) => r.title === title)?.id as string;

  it("shows a bought egg in its own box with how it hatches", () => {
    const { data, id } = withBought("webDev");
    renderWithStudium(<Habitat habitatId={id} onOpenShop={vi.fn()} />, { data });
    expect(document.querySelector(`[data-pet-habitat="${id}"]`)).not.toBeNull();
    screen.getByRole("img", { name: "Frog's egg" });
    screen.getByText(/^Hatches when you finish half of any requirement's tasks/);
  });

  it("asks for a name and what it cares about once it hatches", async () => {
    const { data, id } = withBought("webDev", { stage: "juvenile", hatchedAt: NOW.toISOString() });
    const { storage } = renderWithStudium(<Habitat habitatId={id} onOpenShop={vi.fn()} />, { data });
    const name = screen.getByLabelText("Name") as HTMLInputElement;
    expect(name.value).toBe("Frog");
    await userEvent.clear(name);
    await userEvent.type(name, "Ribbit");
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    screen.getByRole("heading", { name: "Ribbit" });
    screen.getByText("Project Companion");
    expect(savedData(storage).projects.find((p) => p.id === "webDev")?.pets?.[0].name).toBe("Ribbit");
  });

  it("can look after one requirement, and change it later", async () => {
    const { data, id } = withBought("webDev", { stage: "juvenile", hatchedAt: NOW.toISOString() });
    renderWithStudium(<Habitat habitatId={id} onOpenShop={vi.fn()} />, { data });
    await userEvent.selectOptions(screen.getByLabelText("Cares about"), requirementId(data, "Case studies"));
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    screen.getByText("Looks after · Case studies");
    await userEvent.selectOptions(screen.getByLabelText("Cares about"), "");
    screen.getByText("Project Companion");
  });

  it("gives medicine to a sick pet that looks after a requirement", async () => {
    const seed = buildSeed(NOW);
    const { data, id } = withBought("seniorCap", { stage: "adult", hatchedAt: NOW.toISOString(), name: "Frog", caresFor: requirementId(seed, "Prototype v1") });
    data.events.push({ type: "purchase", at: NOW.toISOString(), productId: "medicine", price: 80 });
    const { storage } = renderWithStudium(<Habitat habitatId={id} onOpenShop={vi.fn()} />, { data });
    await userEvent.click(screen.getByRole("button", { name: "Give medicine (1 left)" }));
    expect(savedData(storage).events.slice(-1)[0]).toMatchObject({ type: "medicine_given", projectId: "seniorCap", petId: id });
  });
});

describe("Habitat food", () => {
  const HOUR = 3_600_000;
  const stock = (productId: string): StudiumEvent => ({ type: "purchase", at: daysAgo(2), productId, price: 0 });
  // p1's r1 is half planned with `done` of 10 tasks done: 4 is Worried, 5 Happy. It also has a bought pet x1.
  function fed(o: { done?: number; stocked?: boolean; events?: StudiumEvent[] } = {}): StudiumData {
    const ids = Array.from({ length: 10 }, (_, i) => `t${i}`);
    const done = o.done ?? 4;
    return makeData({
      projects: [makeProject({ pets: [makePet()] })],
      requirements: [makeRequirement({ id: "r1", startDate: dayKey(-10), dueDate: dayKey(10) })],
      tasks: ids.map((id, i) => makeTask({ id, requirementId: "r1", done: i < done })),
      events: [
        ...ids.slice(0, done).map((id) => completed(id, daysAgo(1), { requirementId: "r1" })),
        ...(o.stocked === false ? [] : [stock("berry-bites"), stock("power-bento")]),
        ...(o.events ?? []),
      ],
    });
  }

  it("feeds a worried pet a snack and counts down", async () => {
    const { storage } = renderWithStudium(<Habitat habitatId="p1" onOpenShop={vi.fn()} />, { data: fed() });
    await userEvent.click(screen.getByRole("button", { name: "Feed Berry Bites" }));
    screen.getByText("(Worried, lifted by a snack)");
    screen.getByText("Snack: lifting mood for 2h 0m more");
    screen.getByText("Next snack in 3h 0m");
    expect((screen.getByRole("button", { name: "Feed Berry Bites (3h 0m)" }) as HTMLButtonElement).disabled).toBe(true);
    expect(savedData(storage).events.slice(-1)[0]).toMatchObject({ type: "fed", projectId: "p1", petId: "p1", productId: "berry-bites" });
  });

  it("a meal shows the boost and waits until tomorrow", async () => {
    renderWithStudium(<Habitat habitatId="p1" onOpenShop={vi.fn()} />, { data: fed() });
    await userEvent.click(screen.getByRole("button", { name: "Feed Power Bento" }));
    screen.getByText("Meal: × 1.1 tokens for 4h 0m more");
    screen.getByText("Next meal tomorrow");
    expect((screen.getByRole("button", { name: "Feed Power Bento (tomorrow)" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("a happy pet is not hungry", () => {
    renderWithStudium(<Habitat habitatId="p1" onOpenShop={vi.fn()} />, { data: fed({ done: 5 }) });
    expect((screen.getByRole("button", { name: "Not hungry" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("says a second pet's meal extends the boost", () => {
    const meal: StudiumEvent = { type: "fed", at: new Date(NOW.getTime() - HOUR).toISOString(), projectId: "p1", petId: "x1", productId: "power-bento" };
    renderWithStudium(<Habitat habitatId="p1" onOpenShop={vi.fn()} />, { data: fed({ events: [stock("power-bento"), meal] }) });
    screen.getByText("Meal: × 1.1 tokens for 3h 0m more");
    screen.getByText("Boost already on: this adds 4 hours instead of doubling it.");
  });

  it("offers no food to a sick pet", () => {
    renderWithStudium(<Habitat habitatId="seniorCap" onOpenShop={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /Feed|Not hungry/ })).toBeNull();
  });

  it("sends you to the shop for food you don't have", async () => {
    const onOpenShop = vi.fn();
    renderWithStudium(<Habitat habitatId="p1" onOpenShop={onOpenShop} />, { data: fed({ stocked: false }) });
    await userEvent.click(screen.getByRole("button", { name: "Buy Berry Bites in the Shop" }));
    expect(onOpenShop).toHaveBeenCalled();
  });
});
