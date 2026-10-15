// @vitest-environment jsdom
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NOW } from "../planner/testData";
import { buildSeed } from "../store/seed";
import { renderWithStudium } from "../test/render";
import Habitat, { HABITAT_FALLBACK_MS } from "./Habitat";

afterEach(() => vi.useRealTimers());

describe("Habitat", () => {
  it("marks the box for the extension and shows a still picture if no pet arrives", () => {
    vi.useFakeTimers();
    renderWithStudium(<Habitat projectId="webDev" justHatched={false} onOpenShop={vi.fn()} />);
    expect(document.querySelector('[data-pet-habitat="webDev"]')).not.toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(HABITAT_FALLBACK_MS);
    });
    screen.getByRole("img", { name: "webDev's pigeon" });
  });

  it("shows no still picture when the extension attaches a pet", () => {
    vi.useFakeTimers();
    renderWithStudium(<Habitat projectId="webDev" justHatched={false} onOpenShop={vi.fn()} />);
    document.querySelector('[data-pet-habitat="webDev"]')?.setAttribute("data-pet-attached", "");
    act(() => {
      vi.advanceTimersByTime(HABITAT_FALLBACK_MS);
    });
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("shows mood, plan gap, attention and estimate accuracy", () => {
    renderWithStudium(<Habitat projectId="seniorCap" justHatched={false} onOpenShop={vi.fn()} />);
    expect(screen.getAllByText("Sick").length).toBeGreaterThan(0);
    screen.getByText(/points? behind plan|On plan/);
    screen.getByText("Prototype v1: 16 days idle");
    screen.getByText(/Your seniorCap tasks take about/);
  });

  it("hides estimate accuracy until there are enough timed tasks", () => {
    const data = buildSeed(NOW);
    data.tasks = data.tasks.map((t) => (t.projectId === "webDev" ? { ...t, actualMin: null } : t));
    renderWithStudium(<Habitat projectId="webDev" justHatched={false} onOpenShop={vi.fn()} />, { data });
    screen.getByText(/Finish a few tasks with a time/);
  });

  it("sends you to the shop when a sick pet needs medicine you don't have", async () => {
    const onOpenShop = vi.fn();
    renderWithStudium(<Habitat projectId="seniorCap" justHatched={false} onOpenShop={onOpenShop} />);
    await userEvent.click(screen.getByRole("button", { name: "Buy medicine in the Shop" }));
    expect(onOpenShop).toHaveBeenCalled();
  });

  it("gives medicine and starts recovery", async () => {
    const data = buildSeed(NOW);
    data.events.push({ type: "purchase", at: NOW.toISOString(), productId: "medicine", price: 80 });
    renderWithStudium(<Habitat projectId="seniorCap" justHatched={false} onOpenShop={vi.fn()} />, { data });
    await userEvent.click(screen.getByRole("button", { name: "Give medicine (1 left)" }));
    expect(screen.queryByText("Sick")).toBeNull();
    screen.getByText(/Recovering/);
  });

  it("celebrates a fresh hatch", () => {
    renderWithStudium(<Habitat projectId="petExt" justHatched onOpenShop={vi.fn()} />);
    screen.getByText("It hatched: a turtle!");
  });
});
