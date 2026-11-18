import { canFeed, snackLiftUntil, snackWaitHours, type FeedCheck } from "../planner/food";
import { FAVORITE_FLAVOR, FOODS, isFavorite, type FoodKind, type FoodSpec } from "../planner/foods";
import { inventory } from "../planner/history";
import type { ProjectMood } from "../planner/mood";
import type { PetRef } from "../planner/pets";
import { MEAL_HOURS, MEAL_PRODUCT_ID, SNACK_PRODUCT_ID, SNACK_WAIT_HOURS } from "../planner/tuning";
import { findProduct } from "../store/products";
import { useStudiumContext } from "../store/useStudium";
import { durationLabel } from "../ui/format";
import { mealBoostLine } from "../ui/foodText";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, LABEL, MUTED } from "../ui/styles";

type Props = { pet: PetRef; mood: ProjectMood; onOpenShop: () => void };

const GROUPS: { kind: FoodKind; label: string }[] = [
  { kind: "snack", label: "Snacks" },
  { kind: "meal", label: "Meals" },
];

/**
 * The habitat's Food section (food spec, option A; shop, toys and window spec): what the pet loves,
 * what's running, when it can eat next, and a feed button for each food you own.
 */
export default function FoodPanel({ pet, mood, onOpenShop }: Props) {
  const s = useStudiumContext();
  const now = s.now;
  const events = s.data.events;
  const left = (end: Date) => durationLabel(end.getTime() - now.getTime());
  const liftEnd = mood.liftedFrom ? snackLiftUntil(events, pet.petId, now) : null;
  const boost = mealBoostLine(events, pet.projectId, now);
  const wait = snackWaitHours(events, pet.petId, now);
  const owned = inventory(events);
  const foods = FOODS.filter((f) => (owned[f.id] ?? 0) > 0);

  // The waits don't depend on which food: a snack's or a meal's slot is used up or it isn't.
  const snackSlot = canFeed(s.data, pet, mood, SNACK_PRODUCT_ID, now);
  const mealSlot = canFeed(s.data, pet, mood, MEAL_PRODUCT_ID, now);
  const waits: string[] = [];
  if (!snackSlot.ok && snackSlot.reason === "wait" && snackSlot.nextAt) waits.push(`Next snack in ${left(snackSlot.nextAt)}`);
  if (!mealSlot.ok && mealSlot.reason === "wait") waits.push("Next meal tomorrow");

  const checks = new Map<string, FeedCheck>(foods.map((f) => [f.id, canFeed(s.data, pet, mood, f.id, now)]));
  const name = (food: FoodSpec) => findProduct(food.id)?.name ?? food.id;

  function button(food: FoodSpec) {
    const check = checks.get(food.id)!;
    const favorite = isFavorite(food.id, pet.kind) ? (
      <span aria-hidden="true" className="ml-1 text-xs">
        ♥ Favorite
      </span>
    ) : null;
    if (check.ok) {
      return (
        <button key={food.id} type="button" onClick={() => s.feedPet(pet.projectId, pet.petId, food.id)} className={BUTTON_PRIMARY}>
          {`Feed ${name(food)}`}
          {favorite}
        </button>
      );
    }
    const label =
      check.reason === "not-hungry"
        ? "Not hungry"
        : check.reason === "wait"
          ? `Feed ${name(food)} (${food.kind === "meal" ? "tomorrow" : check.nextAt ? left(check.nextAt) : ""})`
          : `Feed ${name(food)}`;
    return (
      <button key={food.id} type="button" disabled className={BUTTON_PRIMARY}>
        {label}
        {favorite}
      </button>
    );
  }

  const extends_ = foods.some((f) => {
    const c = checks.get(f.id);
    return c?.ok && c.extendsBoost;
  });

  return (
    <div>
      <p className={LABEL}>Food</p>
      <p className={`text-xs ${MUTED}`}>{`Loves ${FAVORITE_FLAVOR[pet.kind]} food`}</p>
      {liftEnd && <p>{`Snack: lifting mood for ${left(liftEnd)} more`}</p>}
      {boost && <p>{boost}</p>}
      {wait < SNACK_WAIT_HOURS && <p>{`Snacks every ${durationLabel(wait * 3_600_000)} today`}</p>}
      {waits.length > 0 && (
        <p className={`text-xs mt-1 ${MUTED}`}>
          {waits.map((w, i) => (
            <span key={w}>
              {i > 0 && " · "}
              <span>{w}</span>
            </span>
          ))}
        </p>
      )}
      {foods.length === 0 ? (
        <div className="mt-2">
          <button type="button" onClick={onOpenShop} className={BUTTON_SECONDARY}>
            Buy food in the Shop
          </button>
        </div>
      ) : (
        GROUPS.map((g) => {
          const group = foods.filter((f) => f.kind === g.kind);
          if (group.length === 0) return null;
          return (
            <div key={g.kind} className="mt-2">
              <p className={`text-xs ${MUTED}`}>{g.label}</p>
              <div className="flex flex-wrap gap-2 mt-1">{group.map(button)}</div>
            </div>
          );
        })
      )}
      {extends_ && <p className={`text-xs mt-1 ${MUTED}`}>{`Boost already on: this adds ${MEAL_HOURS} hours instead of doubling it.`}</p>}
    </div>
  );
}
