import { MEDICINE_PRICE, MEDICINE_PRODUCT_ID } from "../planner/tuning";

export type ShopCategory = "Food" | "Clothes" | "Toys" | "Care";

export type ShopProduct = {
  id: string;
  name: string;
  description: string;
  category: ShopCategory;
  price: number;
};

export const SHOP_PRODUCTS: ShopProduct[] = [
  { id: "berry-bites", name: "Berry Bites", description: "A sweet everyday snack for your companion.", category: "Food", price: 35 },
  { id: "power-bento", name: "Power Bento", description: "A hearty meal for long study sessions.", category: "Food", price: 60 },
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

export function findProduct(id: string): ShopProduct | undefined {
  return SHOP_PRODUCTS.find((p) => p.id === id);
}
