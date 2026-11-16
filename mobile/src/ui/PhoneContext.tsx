// Hands the phone's Studium to the screens and keeps its clock fresh: moods, meal times and today's
// plan change with time, so it re-reads the clock every minute and when the app comes back to the front.
import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { AppState } from "react-native";
import type { PhoneState, PhoneStudium } from "../phoneStudium";

const Ctx = createContext<PhoneStudium | null>(null);
export const TICK_MS = 60_000;

export function PhoneProvider({ phone, children }: { phone: PhoneStudium; children: ReactNode }) {
  useEffect(() => {
    const timer = setInterval(() => phone.tick(), TICK_MS);
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") return;
      phone.tick();
      if (!phone.state().syncing) void phone.reconnect();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [phone]);
  return <Ctx.Provider value={phone}>{children}</Ctx.Provider>;
}

export function usePhone(): { phone: PhoneStudium; state: PhoneState } {
  const phone = useContext(Ctx);
  if (!phone) throw new Error("usePhone needs a PhoneProvider");
  const state = useSyncExternalStore(phone.subscribe, phone.state);
  return { phone, state };
}
