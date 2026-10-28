// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NOW } from "../planner/testData";
import type { StudiumData } from "../planner/types";
import { placeDecor } from "../store/actions";
import { buildSeed } from "../store/seed";
import { renderWithStudium, savedData } from "../test/render";
import Inventory from "./Inventory";

/** The example data with empty habitats (no built-in beds placed) plus one purchase of each id. */
function owning(...ids: string[]): StudiumData {
  const data: StudiumData = { ...buildSeed(NOW), decor: {} };
  for (const productId of ids) data.events.push({ type: "purchase", at: NOW.toISOString(), productId, price: 0 });
  return data;
}

const props = { placing: null, onPlace: vi.fn(), onCancel: vi.fn(), onOpenShop: vi.fn() };
const furnitureTab = () => userEvent.click(screen.getByRole("tab", { name: "Furniture" }));

describe("Inventory", () => {
  it("opens on Items, listing supplies by type, with Give for Medicine", () => {
    renderWithStudium(<Inventory projectId="seniorCap" {...props} />, { data: owning("medicine", "berry-bites") });
    expect(screen.getByRole("tab", { name: "Items" }).getAttribute("aria-selected")).toBe("true");
    screen.getByRole("heading", { name: "Care" });
    screen.getByRole("heading", { name: "Food" });
    expect(screen.queryByRole("heading", { name: "Toys" })).toBeNull();
    screen.getByText("Berry Bites");
    screen.getByRole("button", { name: "Give medicine (1 left)" });
  });

  it("Give medicine cures the sick pet", async () => {
    const { storage } = renderWithStudium(<Inventory projectId="seniorCap" {...props} />, { data: owning("medicine") });
    await userEvent.click(screen.getByRole("button", { name: "Give medicine (1 left)" }));
    expect(savedData(storage).events.some((e) => e.type === "medicine_given" && e.projectId === "seniorCap")).toBe(true);
  });

  it("only offers medicine to a sick pet", () => {
    renderWithStudium(<Inventory projectId="webDev" {...props} />, { data: owning("medicine") });
    screen.getByText("Medicine");
    expect(screen.queryByRole("button", { name: /Give medicine/ })).toBeNull();
  });

  it("Furniture lists owned decor by type with where the copies are", async () => {
    let data = owning("pet-bed", "pet-bed", "pet-bed");
    data = placeDecor(data, "webDev", "floorMiddle", "pet-bed");
    data = placeDecor(data, "appDev", "floorMiddle", "pet-bed");
    renderWithStudium(<Inventory projectId="webDev" {...props} />, { data });
    await furnitureTab();
    const beds = screen.getByRole("region", { name: "Beds" });
    within(beds).getByText("Pet Bed ×3");
    within(beds).getByText("1 here · 1 in appDev · 1 free");
    expect(screen.queryByRole("region", { name: "Rugs" })).toBeNull();
  });

  it("an empty tab points to the Shop", async () => {
    const onOpenShop = vi.fn();
    // Items: the example data has bought nothing. (Furniture always has the built-in bed.)
    renderWithStudium(<Inventory projectId="webDev" {...props} onOpenShop={onOpenShop} />);
    await userEvent.click(screen.getByRole("button", { name: "Visit the Shop" }));
    expect(onOpenShop).toHaveBeenCalled();
  });

  it("lists the habitat's built-in bed, drawn in the project's color", async () => {
    const { storage } = renderWithStudium(<Inventory projectId="webDev" {...props} />);
    await furnitureTab();
    screen.getByText("Cozy Bed ×5");
    const row = screen.getByText("Cozy Bed ×5").closest("li") as HTMLElement;
    expect(row.querySelector("ellipse")?.getAttribute("fill")).toBe("#2d3a8c");
    await userEvent.click(screen.getByRole("button", { name: "Remove Cozy Bed from the middle floor spot" }));
    expect(savedData(storage).decor?.webDev).toBeUndefined();
    screen.getByRole("button", { name: "Place Cozy Bed" });
  });

  it("Use here and Plain set the wallpaper", async () => {
    const { storage } = renderWithStudium(<Inventory projectId="webDev" {...props} />, { data: owning("sage-stripes") });
    await furnitureTab();
    await userEvent.click(screen.getByRole("button", { name: "Use Sage Stripes here" }));
    expect(savedData(storage).decor?.webDev?.wallpaper).toBe("sage-stripes");
    await userEvent.click(screen.getByRole("button", { name: "Plain wallpaper" }));
    expect(savedData(storage).decor?.webDev?.wallpaper).toBeUndefined();
  });

  it("Move here takes a surface from another habitat", async () => {
    const data = placeDecor(owning("sage-stripes"), "appDev", "wallpaper", "sage-stripes");
    const { storage } = renderWithStudium(<Inventory projectId="webDev" {...props} />, { data });
    await furnitureTab();
    screen.getByText("1 in appDev");
    await userEvent.click(screen.getByRole("button", { name: "Move Sage Stripes here" }));
    expect(savedData(storage).decor).toEqual({ webDev: { wallpaper: "sage-stripes" } });
  });

  it("Place and Move here start placing a spot item", async () => {
    const onPlace = vi.fn();
    const data = placeDecor(owning("pet-bed", "clock"), "appDev", "floorMiddle", "pet-bed");
    renderWithStudium(<Inventory projectId="webDev" {...props} onPlace={onPlace} />, { data });
    await furnitureTab();
    await userEvent.click(screen.getByRole("button", { name: "Place Clock" }));
    expect(onPlace).toHaveBeenLastCalledWith({ itemId: "clock" });
    await userEvent.click(screen.getByRole("button", { name: "Move Pet Bed here" }));
    expect(onPlace).toHaveBeenLastCalledWith({ itemId: "pet-bed", from: { projectId: "appDev", slot: "floorMiddle" } });
  });

  it("Remove sends it back", async () => {
    const data = placeDecor(owning("clock"), "webDev", "wallLeft", "clock");
    const { storage } = renderWithStudium(<Inventory projectId="webDev" {...props} />, { data });
    await furnitureTab();
    await userEvent.click(screen.getByRole("button", { name: "Remove Clock from the left wall spot" }));
    expect(savedData(storage).decor?.webDev).toBeUndefined();
  });

  it("shows the placing banner with Cancel", async () => {
    const onCancel = vi.fn();
    renderWithStudium(<Inventory projectId="webDev" {...props} placing={{ itemId: "clock" }} onCancel={onCancel} />, {
      data: owning("clock"),
    });
    screen.getByText("Placing Clock: pick a free spot in the habitat.");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
  });
});
