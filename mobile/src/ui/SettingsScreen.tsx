import Constants from "expo-constants";
import { Pressable, ScrollView, Text, View } from "react-native";
import { usePhone } from "./PhoneContext";
import { ui } from "./theme";

export default function SettingsScreen() {
  const { phone, state } = usePhone();
  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
      <Text style={ui.title}>Settings</Text>
      <Text style={ui.section}>Account</Text>
      <View style={[ui.card, { gap: 4 }]}>
        <Text style={ui.small}>Signed in as</Text>
        <Text style={ui.bold}>{state.account?.email ?? ""}</Text>
        <Text style={ui.small}>{state.syncing ? "Syncing with your other devices." : "Not syncing right now."}</Text>
      </View>
      <Pressable style={ui.buttonSecondary} accessibilityRole="button" onPress={() => void phone.signOut()}>
        <Text style={ui.bold}>Sign out</Text>
      </Pressable>
      <Text style={ui.small}>{`Studium for phones ${Constants.expoConfig?.version ?? ""}`}</Text>
    </ScrollView>
  );
}
