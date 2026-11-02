import { MEDICINE_PRICE, MEDICINE_PRODUCT_ID } from "../planner/tuning";
import { findDecor } from "./decor";

export type ShopCategory = "Food" | "Clothes" | "Toys" | "Care";

export type ShopProduct = {
  id: string;
  name: string;
  description: string;
  category: ShopCategory;
  price: number;
  effect?: string; // what using it does, shown in the Shop (food spec)
};

export const SHOP_PRODUCTS: ShopProduct[] = [
  { id: "berry-bites", name: "Berry Bites", description: "A sweet everyday snack for your companion.", category: "Food", price: 35,
    effect: "Lifts a Worried or Upset pet's mood one step for 2 hours. One snack every 3 hours. Doesn't help a Sick pet." },
  { id: "power-bento", name: "Power Bento", description: "A hearty meal for long study sessions.", category: "Food", price: 60,
    effect: "Tasks on this pet's project earn × 1.1 tokens for 4 hours. One meal a day." },
  { id: "scholar-scarf", name: "Scholar Scarf", description: "A soft scarf with a studious stripe.", category: "Clothes", price: 120 },
  { id: "rainy-day-coat", name: "Rainy-Day Coat", description: "Keeps tiny paws dry in any weather.", category: "Clothes", price: 180 },
  { id: "focus-ball", name: "Focus Ball", description: "A bouncy reward after completing a task.", category: "Toys", price: 75 },
  { id: "puzzle-cube", name: "Puzzle Cube", description: "A clever toy for curious companions.", category: "Toys", price: 150 },
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
