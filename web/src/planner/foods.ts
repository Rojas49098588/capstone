// The food catalog (shop, toys and window spec): each food has a flavor and does one clear thing.
// Each kind of pet has a favorite flavor; no pet's favorite is bland.
import {
  MEAL_HOURS,
  MEAL_PRODUCT_ID,
  MEAL_TOKEN_MULTIPLIER,
  SNACK_HOURS,
  SNACK_PRODUCT_ID,
} from "./tuning";
import type { PetKind } from "./types";

export type FoodKind = "snack" | "meal";
export type Flavor = "sweet" | "savory" | "sour" | "seedy" | "leafy" | "meaty" | "bland";
export type FoodEffect =
  | { type: "lift"; hours: number } // the shown mood goes up one step
  | { type: "tokens"; tokens: number } // tokens right away
  | { type: "boost"; multiplier: number; hours: number; extends: boolean } // the project's tokens, for a while
  | { type: "boostToday"; multiplier: number } // the project's tokens, until local midnight
  | { type: "snackWait"; hours: number }; // this pet's wait between snacks, until local midnight
export type FoodSpec = { id: string; kind: FoodKind; flavor: Flavor; price: number; effect: FoodEffect };

export const FOODS: FoodSpec[] = [
  { id: "plain-crackers", kind: "snack", flavor: "bland", price: 10, effect: { type: "lift", hours: 1 } },
  { id: SNACK_PRODUCT_ID, kind: "snack", flavor: "sweet", price: 35, effect: { type: "lift", hours: SNACK_HOURS } },
  { id: "sour-gummies", kind: "snack", flavor: "sour", price: 40, effect: { type: "tokens", tokens: 15 } },
  { id: "seed-crunch", kind: "snack", flavor: "seedy", price: 50, effect: { type: "lift", hours: 2.25 } },
  { id: "plain-rice", kind: "meal", flavor: "bland", price: 15, effect: { type: "boost", multiplier: 1.03, hours: 4, extends: false } },
  {
    id: MEAL_PRODUCT_ID,
    kind: "meal",
    flavor: "savory",
    price: 60,
    effect: { type: "boost", multiplier: MEAL_TOKEN_MULTIPLIER, hours: MEAL_HOURS, extends: true },
  },
  { id: "garden-salad", kind: "meal", flavor: "leafy", price: 55, effect: { type: "boostToday", multiplier: 1.05 } },
  { id: "meaty-stew", kind: "meal", flavor: "meaty", price: 50, effect: { type: "snackWait", hours: 2.5 } },
];

export const FAVORITE_FLAVOR: Record<PetKind, Flavor> = {
  cat: "savory",
  dog: "meaty",
  frog: "sour",
  pigeon: "seedy",
  turtle: "leafy",
};

export function findFood(productId: string): FoodSpec | undefined {
  return FOODS.find((f) => f.id === productId);
}

export function isFavorite(productId: string, petKind: PetKind): boolean {
  const food = findFood(productId);
  return food !== undefined && food.flavor !== "bland" && FAVORITE_FLAVOR[petKind] === food.flavor;
}

/** "Sour", "Bland", … for showing a flavor. */
export function flavorLabel(flavor: Flavor): string {
  return flavor.charAt(0).toUpperCase() + flavor.slice(1);
}
