// @vitest-environment jsdom
import { screen } from "@testing-library/react";
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
