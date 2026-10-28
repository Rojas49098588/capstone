// @vitest-environment jsdom
import { act, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NOW } from "../planner/testData";
import { buildSeed } from "../store/seed";
import { WAKE_PET_EVENT } from "../store/petStatus";
import { placeDecor } from "../store/actions";
import { renderWithStudium, withEgg } from "../test/render";
import Habitat, { HABITAT_FALLBACK_MS } from "./Habitat";

afterEach(() => vi.useRealTimers());

describe("Habitat", () => {
  it("marks the box for the extension and shows a still picture if no pet arrives", () => {
    vi.useFakeTimers();
    renderWithStudium(<Habitat projectId="webDev" onOpenShop={vi.fn()} />);
    expect(document.querySelector('[data-pet-habitat="webDev"]')).not.toBeNull();
    expect(screen.queryByRole("img", { name: /pigeon/ })).toBeNull();
    act(() => {
      vi.advanceTimersByTime(HABITAT_FALLBACK_MS);
    });
    screen.getByRole("img", { name: "webDev's pigeon" });
  });

  it("shows no still picture when the extension attaches a pet", () => {
    vi.useFakeTimers();
    renderWithStudium(<Habitat projectId="webDev" onOpenShop={vi.fn()} />);
    document.querySelector('[data-pet-habitat="webDev"]')?.setAttribute("data-pet-attached", "");
    act(() => {
      vi.advanceTimersByTime(HABITAT_FALLBACK_MS);
    });
    expect(screen.queryByRole("img", { name: /pigeon/ })).toBeNull();
  });

  it("shows mood, plan gap, attention and estimate accuracy", () => {
    renderWithStudium(<Habitat projectId="seniorCap" onOpenShop={vi.fn()} />);
    expect(screen.getAllByText("Sick").length).toBeGreaterThan(0);
    screen.getByText(/points? behind plan|On plan/);
    screen.getByText("Prototype v1: 16 days idle");
    screen.getByText(/Your seniorCap tasks take about/);
  });

  it("hides estimate accuracy until there are enough timed tasks", () => {
    const data = buildSeed(NOW);
    data.tasks = data.tasks.map((t) => (t.projectId === "webDev" ? { ...t, actualMin: null } : t));
    renderWithStudium(<Habitat projectId="webDev" onOpenShop={vi.fn()} />, { data });
    screen.getByText(/Finish a few tasks with a time/);
  });

  it("sends you to the shop when a sick pet needs medicine you don't have", async () => {
    const onOpenShop = vi.fn();
    renderWithStudium(<Habitat projectId="seniorCap" onOpenShop={onOpenShop} />);
    await userEvent.click(screen.getByRole("button", { name: "Buy medicine in the Shop" }));
    expect(onOpenShop).toHaveBeenCalled();
  });

  it("leaves giving medicine to the inventory", () => {
    const data = buildSeed(NOW);
    data.events.push({ type: "purchase", at: NOW.toISOString(), productId: "medicine", price: 80 });
    renderWithStudium(<Habitat projectId="seniorCap" onOpenShop={vi.fn()} />, { data });
    expect(screen.queryByRole("button", { name: /Give medicine/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Buy medicine in the Shop" })).toBeNull();
  });

  it("brings the still picture back when the extension lets go of the box", async () => {
    vi.useFakeTimers();
    renderWithStudium(<Habitat projectId="webDev" onOpenShop={vi.fn()} />);
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
    renderWithStudium(<Habitat projectId="webDev" onOpenShop={vi.fn()} />);
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
    renderWithStudium(<Habitat projectId="webDev" onOpenShop={vi.fn()} />);
    await setAway(`sleep:${new Date(2026, 9, 14, 13, 30).toISOString()}`);
    screen.getByText("webDev is sleeping");
    screen.getByText(/back at 1:30 PM/);
  });

  it("goes back to normal when the attribute is removed", async () => {
    renderWithStudium(<Habitat projectId="webDev" onOpenShop={vi.fn()} />);
    await setAway(`nap:${inMinutes(12)}`);
    await setAway(null);
    expect(screen.queryByText(/is napping/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Wake" })).toBeNull();
  });

  it("shows the still picture with the napping line when no pet is attached", async () => {
    vi.useFakeTimers();
    renderWithStudium(<Habitat projectId="webDev" onOpenShop={vi.fn()} />);
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
    data = placeDecor(data, "webDev", "floorLeft", "pet-bed");
    renderWithStudium(<Habitat projectId="webDev" onOpenShop={vi.fn()} />, { data });
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
      <Habitat projectId="webDev" onOpenShop={vi.fn()} placing={{ itemId: "clock" }} onPickSlot={onPickSlot} />,
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
      <Habitat projectId="webDev" onOpenShop={vi.fn()} placing={{ itemId: "pet-bed" }} onPickSlot={vi.fn()} />,
      { data },
    );
    expect(screen.queryAllByRole("button", { name: /^Put Pet Bed/ })).toHaveLength(0); // one bed per habitat
  });

  it("hides an item whose image fails to load", () => {
    const data = placeDecor(owning("pet-bed"), "webDev", "floorLeft", "pet-bed");
    renderWithStudium(<Habitat projectId="webDev" onOpenShop={vi.fn()} />, { data });
    fireEvent.error(screen.getByRole("img", { name: "Pet Bed" }));
    expect(screen.queryByRole("img", { name: "Pet Bed" })).toBeNull();
  });
});

describe("Habitat pet stages", () => {
  it("shows the egg straight away, with how many requirements it needs to hatch", () => {
    vi.useFakeTimers();
    const { data, id } = withEgg(1);
    renderWithStudium(<Habitat projectId={id} onOpenShop={vi.fn()} />, { data });
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
    renderWithStudium(<Habitat projectId={id} onOpenShop={vi.fn()} />, { data });
    expect(screen.queryByRole("img", { name: "novel's egg" })).toBeNull();
    act(() => {
      vi.advanceTimersByTime(HABITAT_FALLBACK_MS);
    });
    expect(screen.getByRole("img", { name: "novel's cat" }).style.height).toBe("72px");
  });
});
