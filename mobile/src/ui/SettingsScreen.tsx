import Constants from "expo-constants";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { usePhone } from "./PhoneContext";
import { ui } from "./theme";

export default function SettingsScreen() {
  const { phone, state } = usePhone();
  const [confirming, setConfirming] = useState(false);
  const status = state.unsaved
    ? "Some changes haven't reached your account yet."
    : state.syncing
      ? "Syncing with your other devices."
      : "Not syncing right now.";

  function signOut() {
    // Changes the cloud hasn't acknowledged live only on this phone: signing out would drop them.
    if (state.unsaved && !confirming) setConfirming(true);
    else void phone.signOut();
  }

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
      <Text style={ui.title}>Settings</Text>
      <Text style={ui.section}>Account</Text>
      <View style={[ui.card, { gap: 4 }]}>
        <Text style={ui.small}>Signed in as</Text>
        <Text style={ui.bold}>{state.account?.email ?? ""}</Text>
        <Text style={ui.small}>{status}</Text>
      </View>
      {confirming && state.unsaved ? (
        <>
          <Text style={ui.error}>Signing out now loses them. Sign out anyway?</Text>
          <Pressable style={ui.buttonSecondary} accessibilityRole="button" onPress={() => void phone.signOut()}>
            <Text style={ui.bold}>Sign out anyway</Text>
          </Pressable>
          <Pressable style={ui.buttonSecondary} accessibilityRole="button" onPress={() => setConfirming(false)}>
            <Text style={ui.bold}>Stay signed in</Text>
          </Pressable>
        </>
      ) : (
        <Pressable style={ui.buttonSecondary} accessibilityRole="button" onPress={signOut}>
          <Text style={ui.bold}>Sign out</Text>
        </Pressable>
      )}
      <Text style={ui.small}>{`Studium for phones ${Constants.expoConfig?.version ?? ""}`}</Text>
    </ScrollView>
  );
}
