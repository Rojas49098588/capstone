import { canFeed, mealBoostUntil, snackLiftUntil, type FeedCheck, type FoodKind } from "../planner/food";
import type { ProjectMood } from "../planner/mood";
import type { PetRef } from "../planner/pets";
import { MEAL_HOURS, MEAL_PRODUCT_ID, MEAL_TOKEN_MULTIPLIER, SNACK_PRODUCT_ID } from "../planner/tuning";
import { useStudiumContext } from "../store/useStudium";
import { durationLabel } from "../ui/format";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, LABEL, MUTED } from "../ui/styles";

const FOODS: { kind: FoodKind; productId: string; name: string }[] = [
  { kind: "snack", productId: SNACK_PRODUCT_ID, name: "Berry Bites" },
  { kind: "meal", productId: MEAL_PRODUCT_ID, name: "Power Bento" },
];

type Props = { pet: PetRef; mood: ProjectMood; onOpenShop: () => void };

/** The habitat's Food section (food spec, option A): what's running, when the pet can eat next, and feed buttons. */
export default function FoodPanel({ pet, mood, onOpenShop }: Props) {
  const s = useStudiumContext();
  const now = s.now;
  const liftEnd = mood.liftedFrom ? snackLiftUntil(s.data.events, pet.petId, now) : null;
  const boostEnd = mealBoostUntil(s.data.events, pet.projectId, now);
  const checks = Object.fromEntries(FOODS.map((f) => [f.kind, canFeed(s.data, pet, mood, f.kind, now)])) as Record<FoodKind, FeedCheck>;
  const left = (end: Date) => durationLabel(end.getTime() - now.getTime());

  const waits: string[] = [];
  const snack = checks.snack;
  if (!snack.ok && snack.reason === "wait" && snack.nextAt) waits.push(`Next snack in ${left(snack.nextAt)}`);
  if (!checks.meal.ok && checks.meal.reason === "wait") waits.push("Next meal tomorrow");

  function button(food: (typeof FOODS)[number]) {
    const check = checks[food.kind];
    if (check.ok) {
      return (
        <button key={food.kind} type="button" onClick={() => s.feedPet(pet.projectId, pet.petId, food.productId)} className={BUTTON_PRIMARY}>
          {`Feed ${food.name}`}
        </button>
      );
    }
    if (check.reason === "none-owned") {
      return (
        <button key={food.kind} type="button" onClick={onOpenShop} className={BUTTON_SECONDARY}>
          {`Buy ${food.name} in the Shop`}
        </button>
      );
    }
    const label =
      check.reason === "not-hungry"
        ? "Not hungry"
        : check.reason === "wait"
          ? `Feed ${food.name} (${food.kind === "meal" ? "tomorrow" : check.nextAt ? left(check.nextAt) : ""})`
          : `Feed ${food.name}`;
    return (
      <button key={food.kind} type="button" disabled className={BUTTON_PRIMARY}>
        {label}
      </button>
    );
  }

  return (
    <div>
      <p className={LABEL}>Food</p>
      {liftEnd && <p>{`Snack: lifting mood for ${left(liftEnd)} more`}</p>}
      {boostEnd && <p>{`Meal: × ${MEAL_TOKEN_MULTIPLIER} tokens for ${left(boostEnd)} more`}</p>}
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
      <div className="flex flex-wrap gap-2 mt-2">{FOODS.map(button)}</div>
      {checks.meal.ok && checks.meal.extendsBoost && (
        <p className={`text-xs mt-1 ${MUTED}`}>{`Boost already on: this adds ${MEAL_HOURS} hours instead of doubling it.`}</p>
      )}
    </div>
  );
}
