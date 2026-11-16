// The desktop's own pet art (web/public/pets), bundled into the phone app.
import type { ImageSourcePropType } from "react-native";

export const PET_ART: Record<string, ImageSourcePropType> = {
  cat: require("../../../web/public/pets/cat.png"),
  dog: require("../../../web/public/pets/dog.png"),
  frog: require("../../../web/public/pets/frog.png"),
  pigeon: require("../../../web/public/pets/pigeon.png"),
  turtle: require("../../../web/public/pets/turtle.png"),
  egg: require("../../../web/public/pets/egg.png"),
};
