// @vitest-environment jsdom
// The desktop overlay with a project that has two pets: while the Studium window shows that
// project's habitats, both pets are left off the desktop.
import { expect, it } from "vitest";
import "../../../extension/content/logic.js";
import { fakeChrome, familyPet, shownPets, tick } from "./petFamilyScripts.harness";

it("leaves out every pet whose habitat shows in Studium", async () => {
  const statuses = { updatedAt: new Date().toISOString(), pets: [familyPet("p1"), familyPet("p1", "x1"), familyPet("p2")] };
  const { set } = fakeChrome({ petStatuses: statuses, petHabitat: ["p1", "x1"] });
  (globalThis as unknown as { PetSurface: string }).PetSurface = "overlay";

  // @ts-expect-error pet.js is a plain browser script with no type declarations.
  await import("../../../extension/content/pet.js");
  await tick();
  expect(shownPets()).toEqual([2]);

  await set({ petHabitat: [] }); // another project's page, or the window closed
  await tick();
  expect(shownPets()).toEqual([0, 1, 2]);

  await set({ petHabitat: "x1" }); // the single id an older main process sent
  await tick();
  expect(shownPets()).toEqual([0, 2]);
});
