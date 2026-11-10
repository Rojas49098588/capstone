import { describe, expect, it } from "vitest";
import { authErrorCode } from "./firebaseAuth";
import { batchChanges, docPath } from "./firestoreRemote";

describe("firestore remote helpers", () => {
  it("a first upload of 1,200 records uses 3 batches", () => {
    const batches = batchChanges(Array.from({ length: 1200 }, (_, i) => i));
    expect(batches.map((b) => b.length)).toEqual([450, 450, 300]);
  });

  it("record keys map to the right document paths", () => {
    expect(docPath("u1", "task:t1", { projectId: "p1" })).toBe("projects/p1/tasks/t1");
    expect(docPath("u1", "requirement:r1", { projectId: "p1" })).toBe("projects/p1/requirements/r1");
    expect(docPath("u1", "project:p1", undefined)).toBe("projects/p1");
    expect(docPath("u1", "event:abc", { type: "purchase", at: "2026-01-01T00:00:00Z" })).toBe("users/u1/events/abc");
    expect(docPath("u1", "event:xyz", { type: "fed", at: "2026-01-01T00:00:00Z", projectId: "p2", petId: "p2", productId: "x" })).toBe(
      "projects/p2/events/xyz",
    );
    expect(docPath("u1", "user", undefined)).toBe("users/u1");
  });

  it("a task or requirement whose project is unknown has no path", () => {
    expect(docPath("u1", "task:t1", undefined)).toBeNull();
  });

  it("firebase error codes map to the app's auth errors", () => {
    expect(authErrorCode("auth/wrong-password")).toBe("wrong-password");
    expect(authErrorCode("auth/invalid-credential")).toBe("wrong-password");
    expect(authErrorCode("auth/user-not-found")).toBe("no-account");
    expect(authErrorCode("auth/email-already-in-use")).toBe("email-in-use");
    expect(authErrorCode("auth/weak-password")).toBe("weak-password");
    expect(authErrorCode("auth/network-request-failed")).toBe("network");
    expect(authErrorCode("auth/requires-recent-login")).toBe("needs-recent-sign-in");
    expect(authErrorCode("auth/popup-closed-by-user")).toBe("cancelled");
    expect(authErrorCode("auth/cancelled-popup-request")).toBe("cancelled");
    expect(authErrorCode("auth/whatever")).toBe("other");
  });
});
