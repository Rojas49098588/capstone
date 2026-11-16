// Studium's look (web/src/index.css), for the phone.
import { StyleSheet } from "react-native";

export const colors = {
  background: "#f7f5f2",
  card: "#ffffff",
  foreground: "#1a1816",
  primary: "#2d3a8c",
  accent: "#c9501a",
  border: "#d8d4cc",
  muted: "#8a8680",
  mutedBg: "#eeebe6",
  needsBg: "#fff4ec",
  needsBorder: "#f0c9ad",
};

export const fonts = { serif: "DMSerifDisplay_400Regular", sans: "Inter_400Regular", sansBold: "Inter_600SemiBold" };

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingTop: 56, gap: 10 },
  title: { fontFamily: fonts.serif, fontSize: 28, color: colors.foreground, marginBottom: 6 },
  text: { fontFamily: fonts.sans, fontSize: 15, color: colors.foreground },
  bold: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.foreground },
  small: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted },
  section: { fontFamily: fonts.sansBold, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: colors.muted, marginTop: 8 },
  card: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 10 },
  input: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 10, padding: 10, fontFamily: fonts.sans, fontSize: 15 },
  button: { backgroundColor: colors.primary, borderRadius: 10, padding: 12, alignItems: "center" },
  buttonText: { fontFamily: fonts.sansBold, fontSize: 15, color: "#ffffff" },
  buttonSecondary: { borderColor: colors.border, borderWidth: 1, borderRadius: 10, padding: 12, alignItems: "center" },
  error: { fontFamily: fonts.sans, fontSize: 13, color: colors.accent },
  banner: { backgroundColor: colors.mutedBg, borderRadius: 10, padding: 10 },
});
