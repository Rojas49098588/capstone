import { describe, expect, it } from "vitest";
import { FOODS } from "../planner/foods";
import { SHOP_PRODUCTS, findProduct } from "./products";

describe("the Shop's products", () => {
  it("no longer sells clothes or the Puzzle Cube", () => {
    expect(SHOP_PRODUCTS.some((p) => (p.category as string) === "Clothes")).toBe(false);
    for (const id of ["scholar-scarf", "rainy-day-coat", "puzzle-cube"]) expect(findProduct(id)).toBeUndefined();
  });
  it("sells the Focus Ball and the Robo Mouse as toys", () => {
    expect(findProduct("focus-ball")).toMatchObject({ category: "Toys", price: 75 });
    expect(findProduct("robo-mouse")).toMatchObject({ category: "Toys", price: 120, description: "A wind-up mouse your pet loves to chase." });
  });
  it("sells the 8 foods at the catalog's prices", () => {
    const foods = SHOP_PRODUCTS.filter((p) => p.category === "Food");
    expect(foods.map((p) => [p.id, p.price])).toEqual(FOODS.map((f) => [f.id, f.price]));
  });
  it("says what each new food does", () => {
    expect(findProduct("plain-crackers")?.effect).toBe("Lifts a Worried or Upset pet's mood one step for 1 hour. Uses the pet's snack. Doesn't help a Sick pet.");
    expect(findProduct("sour-gummies")?.effect).toBe("Gives you 15 tokens right away. Uses the pet's snack. Doesn't help a Sick pet.");
    expect(findProduct("seed-crunch")?.effect).toBe(
      "Lifts a Worried or Upset pet's mood one step for 2 h 15 min. One snack every 3 hours. Doesn't help a Sick pet.",
    );
    expect(findProduct("plain-rice")?.effect).toBe("Tasks on this pet's project earn × 1.03 tokens for 4 hours. Uses the pet's meal for the day.");
    expect(findProduct("garden-salad")?.effect).toBe("Tasks on this pet's project earn × 1.05 tokens until midnight. One meal a day.");
    expect(findProduct("meaty-stew")?.effect).toBe("This pet can have a snack every 2 h 30 min instead of 3 hours, until midnight. One meal a day.");
  });
});
