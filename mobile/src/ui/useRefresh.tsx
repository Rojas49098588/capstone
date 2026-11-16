// Pull to refresh: reconnects to the account. Reconnecting is often instant, so the spinner stays up a moment
// and a short "Up to date" line follows, so the person can see it worked.
import { useEffect, useRef, useState } from "react";
import { RefreshControl, Text } from "react-native";
import { usePhone } from "./PhoneContext";
import { colors, ui } from "./theme";

export const REFRESH_MIN_MS = 800;
const NOTE_MS = 3000;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function useRefresh() {
  const { phone } = usePhone();
  const [refreshing, setRefreshing] = useState(false);
  const [done, setDone] = useState(false);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  async function refresh() {
    setDone(false);
    setRefreshing(true);
    await Promise.all([phone.reconnect(), wait(REFRESH_MIN_MS)]);
    if (!mounted.current) return;
    setRefreshing(false);
    // Offline, the screen's message line already says so.
    if (!phone.state().syncing) return;
    setDone(true);
    setTimeout(() => mounted.current && setDone(false), NOTE_MS);
  }

  const control = (
    <RefreshControl testID="refresh" refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} title={refreshing ? "Checking for changes…" : undefined} titleColor={colors.muted} />
  );
  const note = done ? (
    <Text style={[ui.small, { color: colors.primary }]} accessibilityLiveRegion="polite">
      Up to date
    </Text>
  ) : null;
  return { control, note };
}
