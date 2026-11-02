// @vitest-environment jsdom
// @vitest-environment-options {"url":"http://localhost:5173/"}
// The desktop app's Studium window with a project that has two pets: each pet lives in its own
// habitat box, and the main process is told every box on the page.
import { expect, it } from "vitest";
import "../../../extension/content/logic.js";
import { fakeChrome, familyPet, shownPets, tick } from "./petFamilyScripts.harness";

it("puts every pet in its own box and reports all the boxes", async () => {
  const statuses = { updatedAt: new Date().toISOString(), pets: [familyPet("p1"), familyPet("p1", "x1"), familyPet("p2")] };
  const { messages } = fakeChrome({ petStatuses: statuses });
  (globalThis as unknown as { PetSurface: string }).PetSurface = "habitat";

  // @ts-expect-error pet.js is a plain browser script with no type declarations.
  await import("../../../extension/content/pet.js");
  await tick();

  const boxes = ["p1", "x1"].map((id) => {
    const box = document.createElement("div");
    box.dataset.petHabitat = id;
    document.body.appendChild(box);
    return box;
  });
  await tick();
  expect(shownPets()).toEqual([0, 1]);
  expect(boxes.map((b) => b.hasAttribute("data-pet-attached"))).toEqual([true, true]);
  expect(messages[messages.length - 1]).toEqual({ type: "habitat", ids: ["p1", "x1"] });

  boxes[1].remove();
  await tick();
  expect(shownPets()).toEqual([0]);
  expect(messages[messages.length - 1]).toEqual({ type: "habitat", ids: ["p1"] });

  boxes[0].remove();
  await tick();
  expect(shownPets()).toEqual([]);
  expect(messages[messages.length - 1]).toEqual({ type: "habitat", ids: [] });
});
