import { MEDICINE_PRICE, MEDICINE_PRODUCT_ID } from "../planner/tuning";
import { findFood } from "../planner/foods";
import { findDecor } from "./decor";

export type ShopCategory = "Food" | "Toys" | "Care";

export type ShopProduct = {
  id: string;
  name: string;
  description: string;
  category: ShopCategory;
  price: number;
  effect?: string; // what using it does, shown in the Shop (food spec)
  image?: string; // a picture under web/public/, e.g. "food/plain-crackers.svg"; replace the file to change the art
};

/** A food's Shop entry: its price comes from the food catalog (planner/foods.ts). */
function food(id: string, name: string, description: string, effect: string): ShopProduct {
  const spec = findFood(id);
  if (!spec) throw new Error(`No food ${id} in the catalog`);
  return { id, name, description, category: "Food", price: spec.price, effect, image: `food/${id}.svg` };
}

export const SHOP_PRODUCTS: ShopProduct[] = [
  food("plain-crackers", "Plain Crackers", "A cheap, plain snack. Pets eat it, but nobody loves it.",
    "Lifts a Worried or Upset pet's mood one step for 1 hour. Uses the pet's snack. Doesn't help a Sick pet."),
  food("berry-bites", "Berry Bites", "A sweet everyday snack for your companion.",
    "Lifts a Worried or Upset pet's mood one step for 2 hours. One snack every 3 hours. Doesn't help a Sick pet."),
  food("sour-gummies", "Sour Gummies", "Tangy chewy gummies that make a pet pucker.",
    "Gives you 15 tokens right away. Uses the pet's snack. Doesn't help a Sick pet."),
  food("seed-crunch", "Seed Crunch", "A crunchy mix of toasted seeds.",
    "Lifts a Worried or Upset pet's mood one step for 2 h 15 min. One snack every 3 hours. Doesn't help a Sick pet."),
  food("plain-rice", "Plain Rice", "A cheap, plain bowl of rice. Filling, if not exciting.",
    "Tasks on this pet's project earn × 1.03 tokens for 4 hours. Uses the pet's meal for the day."),
  food("power-bento", "Power Bento", "A hearty meal for long study sessions.",
    "Tasks on this pet's project earn × 1.1 tokens for 4 hours. One meal a day."),
  food("garden-salad", "Garden Salad", "Crisp greens for a steady day of work.",
    "Tasks on this pet's project earn × 1.05 tokens until midnight. One meal a day."),
  food("meaty-stew", "Meaty Stew", "A warm, slow-cooked stew.",
    "This pet can have a snack every 2 h 30 min instead of 3 hours, until midnight. One meal a day."),
  { id: "focus-ball", name: "Focus Ball", description: "A bouncy reward after completing a task.", category: "Toys", price: 75 },
  { id: "robo-mouse", name: "Robo Mouse", description: "A wind-up mouse your pet loves to chase.", category: "Toys", price: 120 },
  {
    id: MEDICINE_PRODUCT_ID,
    name: "Medicine",
    description: "Cures a sick companion and starts a 3-day recovery.",
    category: "Care",
    price: MEDICINE_PRICE,
  },
];

/** The price of anything the Shop sells: supplies and habitat decor (not the built-in bed). */
export function priceOf(id: string): number | undefined {
  const decor = findDecor(id);
  return (findProduct(id) ?? (decor?.builtIn ? undefined : decor))?.price;
}

export function findProduct(id: string): ShopProduct | undefined {
  return SHOP_PRODUCTS.find((p) => p.id === id);
}
