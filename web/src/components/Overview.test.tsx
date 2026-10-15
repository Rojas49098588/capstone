// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithStudium, savedData } from "../test/render";
import Overview from "./Overview";

describe("Overview", () => {
  it("shows today's plan from the saved data", () => {
    renderWithStudium(<Overview onSelect={vi.fn()} onRequestComplete={vi.fn()} />);
    const today = screen.getByRole("region", { name: "Today" });
    within(today).getByText("Write case study #3");
    within(today).getByText("Weight paint character");
  });

  it("moves a suggestion into today", async () => {
    const { storage } = renderWithStudium(<Overview onSelect={vi.fn()} onRequestComplete={vi.fn()} />);
    const suggested = screen.getByRole("region", { name: "Suggested next" });
    const add = within(suggested).getAllByRole("button", { name: /^Add .* to today$/ })[0];
    const title = (add.getAttribute("aria-label") ?? "").replace(/^Add /, "").replace(/ to today$/, "");
    await userEvent.click(add);
    within(screen.getByRole("region", { name: "Today" })).getByText(title);
    expect(savedData(storage).today.taskIds.length).toBe(3);
  });

  it("completes from Today through the prompt and can remove items", async () => {
    const onRequestComplete = vi.fn();
    const { storage } = renderWithStudium(<Overview onSelect={vi.fn()} onRequestComplete={onRequestComplete} />);
    await userEvent.click(screen.getByRole("checkbox", { name: "Complete Write case study #3" }));
    expect(onRequestComplete).toHaveBeenCalledWith("webDev-t5");
    await userEvent.click(screen.getByRole("button", { name: "Remove Weight paint character from today" }));
    expect(savedData(storage).today.taskIds).toEqual(["webDev-t5"]);
  });

  it("shows each project's mood and opens it", async () => {
    const onSelect = vi.fn();
    renderWithStudium(<Overview onSelect={onSelect} onRequestComplete={vi.fn()} />);
    const card = screen.getByRole("button", { name: /Senior Capstone Project/ });
    within(card).getByText("Sick");
    await userEvent.click(card);
    expect(onSelect).toHaveBeenCalledWith("seniorCap");
  });

  it("shows total progress", () => {
    renderWithStudium(<Overview onSelect={vi.fn()} onRequestComplete={vi.fn()} />);
    screen.getByText("Total Progress — All Projects");
    screen.getByRole("heading", { name: "Your Projects" });
  });
});
