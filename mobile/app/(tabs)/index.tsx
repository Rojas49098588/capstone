import { petGroups } from "@shared/companion/view";
import { emptyData } from "@shared/store/seed";
import { Text, View } from "react-native";

export default function Screen() {
  const now = new Date();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text>{`Pets (${petGroups(emptyData(now), now).length} projects)`}</Text>
    </View>
  );
}
