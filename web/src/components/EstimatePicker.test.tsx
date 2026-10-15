// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
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

describe("EstimatePicker typing", () => {
  function Harness({ start }: { start: number }) {
    const [value, setValue] = useState(start);
    return (
      <>
        <EstimatePicker label="Time taken" value={value} onChange={setValue} />
        <output data-testid="value">{value}</output>
      </>
    );
  }

  it.each(["150", "300", "305", "600"])("keeps every digit of %s minutes", async (typed) => {
    render(<Harness start={60} />);
    await userEvent.type(screen.getByLabelText("Time taken in minutes"), typed);
    expect(screen.getByTestId("value").textContent).toBe(typed);
    expect((screen.getByLabelText("Time taken in minutes") as HTMLInputElement).value).toBe(typed);
  });

  it("can clear a custom value and type a new one", async () => {
    render(<Harness start={45} />);
    const box = screen.getByLabelText("Time taken in minutes");
    await userEvent.clear(box);
    await userEvent.type(box, "90");
    expect(screen.getByTestId("value").textContent).toBe("90");
  });
});
