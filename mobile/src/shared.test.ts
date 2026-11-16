// The phone imports the web app's own code through the @shared alias (metro.config.js, tsconfig.json, jest config).
import { petGroups } from "@shared/companion/view";
import { emptyData } from "@shared/store/seed";

test("the web app's code loads on the phone", () => {
  const now = new Date();
  expect(petGroups(emptyData(now), now)).toEqual([]);
});
