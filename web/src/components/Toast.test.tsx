// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../test/render";
import Toast from "./Toast";

afterEach(() => vi.useRealTimers());

describe("Toast", () => {
  it("shows a message and can be dismissed", async () => {
    const onDismiss = vi.fn();
    render(<Toast message="+29 tokens" onDismiss={onDismiss} />);
    expect(screen.getByRole("status").textContent).toContain("+29 tokens");
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it("dismisses itself after a while", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<Toast message="Saved" onDismiss={onDismiss} timeoutMs={1000} />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onDismiss).toHaveBeenCalled();
  });
});
