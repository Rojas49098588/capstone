// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import "../test/render";
import EstimatePicker from "./EstimatePicker";

describe("EstimatePicker", () => {
  it("marks the current choice and reports a new one", async () => {
    const onChange = vi.fn();
    render(<EstimatePicker label="Estimate" value={60} onChange={onChange} />);
    expect(screen.getByRole("radio", { name: "1 h" }).getAttribute("aria-checked")).toBe("true");
    await userEvent.click(screen.getByRole("radio", { name: "2 h" }));
    expect(onChange).toHaveBeenCalledWith(120);
  });

  it("accepts a custom number of minutes", () => {
    const onChange = vi.fn();
    render(<EstimatePicker label="Estimate" value={60} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Estimate in minutes"), { target: { value: "45" } });
    expect(onChange).toHaveBeenCalledWith(45);
  });

  it("shows a custom value in the box", () => {
    render(<EstimatePicker label="Estimate" value={45} onChange={() => {}} />);
    expect((screen.getByLabelText("Estimate in minutes") as HTMLInputElement).value).toBe("45");
  });
});
