// Firebase's React Native build of auth exports getReactNativePersistence, but its package lists the browser
// types first, so TypeScript doesn't see it. Declared here (runtime: @firebase/auth's react-native build).
import type { Persistence } from "@firebase/auth";

declare module "@firebase/auth" {
  export function getReactNativePersistence(storage: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
  }): Persistence;
}
