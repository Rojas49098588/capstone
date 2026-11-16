import "../src/polyfills"; // first: the shared code needs crypto.randomUUID
import { DMSerifDisplay_400Regular } from "@expo-google-fonts/dm-serif-display";
import { Inter_400Regular, Inter_600SemiBold } from "@expo-google-fonts/inter";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { createFirebase } from "../src/firebase";
import { loadPhoneStorage } from "../src/phoneStorage";
import { createPhoneStudium, type PhoneStudium } from "../src/phoneStudium";
import { PhoneProvider } from "../src/ui/PhoneContext";
import Root from "../src/ui/Root";

export { ErrorBoundary } from "expo-router";

SplashScreen.preventAutoHideAsync();

/** One per app run: the phone's storage is read from AsyncStorage first. */
let starting: Promise<PhoneStudium> | null = null;
function startPhone(): Promise<PhoneStudium> {
  starting ??= loadPhoneStorage().then((storage) => createPhoneStudium({ ...createFirebase(), storage, clock: () => new Date() }));
  return starting;
}

export default function RootLayout() {
  const [loaded, error] = useFonts({ DMSerifDisplay_400Regular, Inter_400Regular, Inter_600SemiBold });
  const [phone, setPhone] = useState<PhoneStudium | null>(null);
  useEffect(() => {
    void startPhone().then(setPhone);
  }, []);
  useEffect(() => {
    if (error) throw error;
  }, [error]);
  const ready = loaded && phone !== null;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);
  if (!ready) return null;
  return (
    <PhoneProvider phone={phone}>
      <Root>
        <Stack screenOptions={{ headerShown: false }} />
      </Root>
    </PhoneProvider>
  );
}
