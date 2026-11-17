// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import "../test/render";
import { memoryStorage } from "../test/render";
import RefundNotice, { REFUND_NOTICE_KEY } from "./RefundNotice";

describe("RefundNotice", () => {
  it("says how many tokens came back, once per device", async () => {
    const storage = memoryStorage();
    const { unmount } = render(<RefundNotice tokens={300} storage={storage} />);
    expect(screen.getByRole("status").textContent).toContain("Clothes are gone for now, so you got 300 tokens back.");
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("status")).toBeNull();
    expect(storage.getItem(REFUND_NOTICE_KEY)).toBe("1");
    unmount();
    render(<RefundNotice tokens={300} storage={storage} />);
    expect(screen.queryByRole("status")).toBeNull();
  });
  it("shows nothing when nothing was refunded", () => {
    render(<RefundNotice tokens={0} storage={memoryStorage()} />);
    expect(screen.queryByRole("status")).toBeNull();
  });
});
