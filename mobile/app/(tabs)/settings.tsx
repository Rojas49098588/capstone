import { firestoreSettings } from "@shared/sync/firestoreRemote";
import { Text, View } from "react-native";

export default function Screen() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text>{`Settings (${firestoreSettings({ phone: true }).ignoreUndefinedProperties ? "ready" : ""})`}</Text>
    </View>
  );
}
