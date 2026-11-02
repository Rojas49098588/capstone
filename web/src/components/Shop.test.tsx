// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { NOW } from "../planner/testData";
import { buildSeed } from "../store/seed";
import { buyEgg } from "../store/actions";
import { renderWithStudium, savedData } from "../test/render";
import Shop from "./Shop";

describe("Shop", () => {
  it("shows the balance and the Care section with Medicine", () => {
    renderWithStudium(<Shop />);
    screen.getByText("650");
    screen.getByRole("heading", { name: "Care" });
    screen.getByText("Medicine");
  });

  it("each food says what it does", () => {
    renderWithStudium(<Shop />);
    const card = (name: string) => screen.getByRole("heading", { name }).closest("article") as HTMLElement;
    within(card("Berry Bites")).getByText("Lifts a Worried or Upset pet's mood one step for 2 hours. One snack every 2 hours. Doesn't help a Sick pet.");
    within(card("Power Bento")).getByText("Tasks on this pet's project earn × 1.1 tokens for 4 hours. One meal a day.");
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

describe("Shop Pets tab", () => {
  const section = (kind: string) => screen.getByRole("region", { name: kind });

  it("shows one egg for each kind of pet", async () => {
    renderWithStudium(<Shop />);
    await userEvent.click(screen.getByRole("tab", { name: "Pets" }));
    for (const kind of ["Cat", "Dog", "Frog", "Pigeon", "Turtle"]) screen.getByRole("heading", { name: kind });
    expect(screen.getAllByRole("button", { name: "Buy · 400 tokens" })).toHaveLength(5);
  });

  it("buys an egg for the chosen project", async () => {
    const { storage } = renderWithStudium(<Shop />);
    await userEvent.click(screen.getByRole("tab", { name: "Pets" }));
    const frog = section("Frog");
    const buy = within(frog).getByRole("button", { name: "Buy · 400 tokens" }) as HTMLButtonElement;
    expect(buy.disabled).toBe(true);
    await userEvent.selectOptions(within(frog).getByLabelText("Project"), "webDev");
    await userEvent.click(buy);
    screen.getByText("250");
    within(frog).getByText(/^The egg is in webDev's habitats\. It hatches when you finish half of any/);
    expect(savedData(storage).projects.find((p) => p.id === "webDev")?.pets?.[0]).toMatchObject({ kind: "frog", stage: "egg" });
  });

  it("says why a project can't take an egg", async () => {
    const data = buyEgg(buildSeed(NOW), "webDev", "cat", NOW).data;
    renderWithStudium(<Shop openTab="pets" />, { data });
    const option = within(section("Dog")).getByRole("option", { name: "webDev (an egg is already waiting)" }) as HTMLOptionElement;
    expect(option.disabled).toBe(true);
  });

  it("asks for more tokens when you can't afford an egg", () => {
    renderWithStudium(<Shop openTab="pets" />, { data: { ...buildSeed(NOW), startingTokens: 100 } });
    const need = within(section("Cat")).getByRole("button", { name: "Need 300 more" }) as HTMLButtonElement;
    expect(need.disabled).toBe(true);
  });
});
