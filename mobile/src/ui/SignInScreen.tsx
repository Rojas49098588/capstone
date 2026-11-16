import type { AuthError } from "@shared/sync/auth";
import { authErrorMessage } from "@shared/ui/format";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput } from "react-native";
import { usePhone } from "./PhoneContext";
import { colors, ui } from "./theme";

export const NO_ACCOUNT_LINE = "No account yet? Make one in Studium on your computer, under Settings → Account.";

export default function SignInScreen() {
  const { phone } = usePhone();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn() {
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await phone.signIn(email, password);
    } catch (e) {
      const code = (e as { code?: AuthError }).code ?? "other";
      setError(authErrorMessage(code) ?? "");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
      <Text style={ui.title}>Studium</Text>
      <Text style={ui.text}>Sign in with your Studium account to see your pets and today's plan.</Text>
      <TextInput
        style={ui.input}
        accessibilityLabel="Email"
        placeholder="Email"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={ui.input}
        accessibilityLabel="Password"
        placeholder="Password"
        secureTextEntry
        autoComplete="password"
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={signIn}
      />
      {error ? <Text style={ui.error}>{error}</Text> : null}
      <Pressable style={[ui.button, busy && { opacity: 0.6 }]} accessibilityRole="button" disabled={busy} onPress={signIn}>
        <Text style={ui.buttonText}>{busy ? "Signing in…" : "Sign in"}</Text>
      </Pressable>
      <Text style={[ui.small, { color: colors.muted }]}>{NO_ACCOUNT_LINE}</Text>
    </ScrollView>
  );
}
