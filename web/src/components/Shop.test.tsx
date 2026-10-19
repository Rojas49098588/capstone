// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { NOW } from "../planner/testData";
import { buildSeed } from "../store/seed";
import { renderWithStudium } from "../test/render";
import Shop from "./Shop";

describe("Shop", () => {
  it("shows the balance and the Care section with Medicine", () => {
    renderWithStudium(<Shop />);
    screen.getByText("650");
    screen.getByRole("heading", { name: "Care" });
    screen.getByText("Medicine");
  });

  it("buys an item", async () => {
    renderWithStudium(<Shop />);
    await userEvent.click(screen.getByRole("button", { name: "Buy · 80 tokens" }));
    screen.getByText("570");
    screen.getByText("Owned ×1");
  });

  it("disables what you can't afford", () => {
    const data = buildSeed(NOW);
    data.events.push({ type: "purchase", at: NOW.toISOString(), productId: "rainy-day-coat", price: 600 });
    renderWithStudium(<Shop />, { data });
    expect((screen.getByRole("button", { name: "Need 30 more" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("Shop tabs", () => {
  it("opens on Supplies, as a tablist", () => {
    renderWithStudium(<Shop />);
    const supplies = screen.getByRole("tab", { name: "Supplies" });
    expect(supplies.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "Habitat" }).getAttribute("aria-selected")).toBe("false");
    screen.getByRole("heading", { name: "Care" });
    expect(screen.queryByRole("heading", { name: "Wallpaper" })).toBeNull();
  });

  it("the Habitat tab lists decor grouped by type", async () => {
    renderWithStudium(<Shop />);
    await userEvent.click(screen.getByRole("tab", { name: "Habitat" }));
    for (const name of ["Wallpaper", "Flooring", "Rugs", "Wall decor", "Beds", "Pet furniture"]) screen.getByRole("heading", { name });
    expect(screen.queryByRole("heading", { name: "Care" })).toBeNull();
    const post = screen.getByRole("article", { name: "Scratching Post" });
    within(post).getByText("For the cat");
  });

  it("buys decor", async () => {
    renderWithStudium(<Shop />);
    await userEvent.click(screen.getByRole("tab", { name: "Habitat" }));
    const bed = screen.getByRole("article", { name: "Pet Bed" });
    await userEvent.click(within(bed).getByRole("button", { name: "Buy · 150 tokens" }));
    screen.getByText("500");
    within(bed).getByText("Owned ×1");
  });
});
