import { describe, expect, it, vi } from "vitest";

const initializeApp = vi.hoisted(() => vi.fn(() => ({})));
vi.mock("firebase/app", () => ({ initializeApp }));
vi.mock("./firebaseAuth", () => ({ createFirebaseAuth: () => ({}) }));
vi.mock("./firestoreRemote", () => ({ createFirestoreRemote: () => ({}) }));

describe("createFirebaseServices", () => {
  it("starts Firebase once however many times it is called (React StrictMode runs effects twice)", async () => {
    const { createFirebaseServices } = await import("./services");
    const a = createFirebaseServices();
    const b = createFirebaseServices();
    expect(b).toBe(a);
    expect(await a).toBe(await b);
    expect(initializeApp).toHaveBeenCalledTimes(1);
  });
});
