// The two tutorials (components/Tour.tsx): what each step points at and says. A step's target is
// the element with that data-tour attribute; a step without one is a card in the middle of the
// screen. `page` is where the app goes for the step; "project" steps use the project the tour began
// on. `shopTab` opens that tab of the Shop for the step.

import { HATCH_REQUIREMENTS } from "../planner/tuning";

export type TourId = "project" | "shop";
export type TourPage = "project" | "overview" | "shop" | "settings";
export type TourStep = { id: string; page: TourPage; target?: string; shopTab?: "habitat"; title: string; text: string };

/** Both tutorials end here, so people know where to replay them. */
const replayStep = (text: string): TourStep => ({
  id: "settings",
  page: "settings",
  target: "settings-tutorial",
  title: "Replay any time",
  text,
});

/** The first tutorial: the project page and the Overview. Starts the first time a project page opens. */
export const PROJECT_TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    page: "project",
    title: "Welcome to your project",
    text: "This quick tour shows how Studium works: your project page and the Overview. Skip it any time; you can replay it from Settings.",
  },
  {
    id: "progress",
    page: "project",
    target: "project-progress",
    title: "Overall progress",
    text: "How much of the project is done. Requirements that count for more move it further. The deadline is at the top right.",
  },
  {
    id: "requirements",
    page: "project",
    target: "requirements",
    title: "Requirements and tasks",
    text: "Requirements are the big pieces of the project, each with a weight from 1 to 10. Break each one into tasks with a time estimate, and tick a task off when it's done to earn tokens.",
  },
  {
    id: "habitat",
    page: "project",
    target: "habitat",
    title: "Your companion",
    text: `Every project starts as an egg and hatches once it has ${HATCH_REQUIREMENTS} requirements. Its mood follows your work: it gets worried when a requirement sits untouched for a while. With the browser extension it walks around your other pages too; right-click it to nap while you focus.`,
  },
  {
    id: "inventory",
    page: "project",
    target: "inventory",
    title: "Inventory",
    text: "What you've bought. Give medicine to a sick pet here, and place furniture in the habitat: your pet naps in its bed and uses the furniture made for it.",
  },
  {
    id: "overview",
    page: "overview",
    target: "total-progress",
    title: "The Overview",
    text: "Every project at a glance. Total progress combines them all; pick a project to open it.",
  },
  {
    id: "focus",
    page: "overview",
    target: "priority-focus",
    title: "What matters next",
    text: "Today's plan and the suggested next tasks across all your projects, so you always know what to work on.",
  },
  {
    id: "new-project",
    page: "overview",
    target: "new-project",
    title: "New projects",
    text: "Start another project here. Each one starts as an egg.",
  },
  replayStep("Replay this tutorial here any time. The Shop has its own tutorial, which starts the first time you open the Shop. That's it: have fun studying!"),
];

/** The second tutorial: the Shop and decorating a habitat. Starts the first time the Shop opens. */
export const SHOP_TOUR_STEPS: TourStep[] = [
  {
    id: "shop-welcome",
    page: "shop",
    title: "Welcome to the Shop",
    text: "This tour shows how to spend your tokens and how to decorate your pets' habitats. Skip it any time; you can replay it from Settings.",
  },
  {
    id: "balance",
    page: "shop",
    target: "shop-balance",
    title: "Study tokens",
    text: "Finishing tasks earns study tokens. Your balance is here and in the top bar.",
  },
  {
    id: "shop-tabs",
    page: "shop",
    target: "shop-tabs",
    title: "Supplies and Habitat",
    text: "Supplies are food, clothes, toys and medicine for your pets. Habitat is decor for your pets' rooms.",
  },
  {
    id: "decor-types",
    page: "shop",
    shopTab: "habitat",
    target: "decor-shop",
    title: "Kinds of decor",
    text: "Wallpaper and flooring cover the whole room. Rugs lie in the middle of the floor. Wall decor hangs on the wall. Beds are where your pet naps, and pet furniture gives it something to do.",
  },
  {
    id: "pet-furniture",
    page: "shop",
    shopTab: "habitat",
    target: "decor-petFurniture",
    title: "Furniture for each pet",
    text: "Each piece of pet furniture is made for one kind of pet, and only that pet uses it: the Scratching Post for cats, the Heat Lamp for turtles, the Perch for pigeons, the Mini Sofa for dogs and the Log for frogs.",
  },
  {
    id: "habitat-spots",
    page: "project",
    target: "habitat",
    title: "Spots in the habitat",
    text: "Each habitat has three floor spots (left, middle and right) and two wall spots. A bed can go in any floor spot, one bed per habitat; rugs only go in the middle. Wall decor and the Perch go on the wall spots.",
  },
  {
    id: "placing",
    page: "project",
    target: "inventory",
    title: "Decorating",
    text: "Your decor waits here. Wallpaper and flooring: choose Use here. Anything else: choose Place, then click a spot that lights up in the habitat. Move here and Remove rearrange what's already out.",
  },
  replayStep("Replay this tutorial, or the project tutorial, here any time. Have fun decorating!"),
];

const TOURS: Record<TourId, TourStep[]> = { project: PROJECT_TOUR_STEPS, shop: SHOP_TOUR_STEPS };

/** The steps a tutorial can show: without a project to show, the project page steps are left out. */
export function tourSteps(tour: TourId, hasProject: boolean): TourStep[] {
  const steps = TOURS[tour];
  return hasProject ? steps : steps.filter((s) => s.page !== "project");
}
