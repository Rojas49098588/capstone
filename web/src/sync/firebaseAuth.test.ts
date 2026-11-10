import { GoogleAuthProvider, OAuthProvider } from "firebase/auth";
import { describe, expect, it } from "vitest";
import { providerFor } from "./firebaseAuth";

describe("providerFor", () => {
  it("Apple is the apple.com provider asking for email and name", () => {
    const p = providerFor("apple");
    expect(p).toBeInstanceOf(OAuthProvider);
    expect(p.providerId).toBe("apple.com");
    expect(p.getScopes()).toEqual(["email", "name"]);
  });

  it("Google is the Google provider", () => {
    expect(providerFor("google")).toBeInstanceOf(GoogleAuthProvider);
  });
});
