// Sign in first; once signed in, the app (the tabs).
import type { ReactNode } from "react";
import { usePhone } from "./PhoneContext";
import SignInScreen from "./SignInScreen";

export default function Root({ children }: { children: ReactNode }) {
  const { state } = usePhone();
  return state.account ? <>{children}</> : <SignInScreen />;
}
