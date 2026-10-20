// The tutorial tour (components/Tour.tsx): what each step points at and says. A step's target is
// the element with that data-tour attribute; a step without one is a card in the middle of the
// screen. `page` is where the app goes for the step; "project" steps use the project the tour began on.

export type TourPage = "project" | "overview" | "shop";
export type TourStep = { id: string; page: TourPage; target?: string; title: string; text: string };

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    page: "project",
    title: "Welcome to your project",
    text: "This quick tour shows how Studium works: your project page, the Overview and the Shop. Skip it any time; you can replay it from Settings.",
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
    text: "Every project hatches a pet. Its mood follows your work: it gets worried when a requirement sits untouched for a while. With the browser extension it walks around your other pages too; right-click it to nap while you focus.",
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
    text: "Start another project here. Each one hatches its own pet.",
  },
  {
    id: "balance",
    page: "shop",
    target: "shop-balance",
    title: "Study tokens",
    text: "Finishing tasks earns study tokens. Your balance is here and in the top bar.",
  },
  {
    id: "shop",
    page: "shop",
    target: "shop-tabs",
    title: "The Shop",
    text: "Spend tokens on supplies (food, clothes, toys and medicine) and on Habitat decor for your pets' rooms.",
  },
  {
    id: "settings",
    page: "shop",
    target: "settings",
    title: "Settings",
    text: "Change your preferences here, or replay this tour any time. That's it: have fun studying!",
  },
];

/** The steps a tour can show: without a project to show, the project page steps are left out. */
export function tourSteps(hasProject: boolean): TourStep[] {
  return hasProject ? TOUR_STEPS : TOUR_STEPS.filter((s) => s.page !== "project");
}
