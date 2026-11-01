// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import "../test/render";
import WaitingOn from "./WaitingOn";

const three = ["EAS build", "APK", "Git commit (Prototype 9)"];

describe("WaitingOn", () => {
  it("shows nothing when there's nothing to wait on", () => {
    const { container } = render(<WaitingOn names={[]} />);
    expect(container.textContent).toBe("");
  });

  it("names a single blocker", () => {
    render(<WaitingOn names={["Prototype 9"]} />);
    screen.getByText("Waiting on Prototype 9");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows a count and lists the blockers on hover", async () => {
    render(<WaitingOn names={three} />);
    const button = screen.getByRole("button", { name: "Waiting on 3" });
    expect(screen.queryByRole("list")).toBeNull();
    await userEvent.hover(button);
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual(three);
    await userEvent.unhover(button);
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("opens and closes with a tap, and closes on Escape", async () => {
    render(<WaitingOn names={three} />);
    const button = screen.getByRole("button", { name: "Waiting on 3" });
    const tap = () => userEvent.pointer({ keys: "[TouchA]", target: button });
    await tap();
    expect(button.getAttribute("aria-expanded")).toBe("true");
    screen.getByRole("list");
    await tap();
    expect(screen.queryByRole("list")).toBeNull();
    await tap();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("stays open when clicked with a mouse", async () => {
    render(<WaitingOn names={three} />);
    await userEvent.click(screen.getByRole("button", { name: "Waiting on 3" }));
    screen.getByRole("list");
  });

  it("opens on keyboard focus", async () => {
    render(<WaitingOn names={three} />);
    await userEvent.tab();
    screen.getByRole("list");
    await userEvent.tab();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("closes when tapping elsewhere", async () => {
    render(
      <div>
        <WaitingOn names={three} />
        <p>elsewhere</p>
      </div>,
    );
    await userEvent.pointer({ keys: "[TouchA]", target: screen.getByRole("button", { name: "Waiting on 3" }) });
    screen.getByRole("list");
    await userEvent.pointer({ keys: "[TouchA]", target: screen.getByText("elsewhere") });
    expect(screen.queryByRole("list")).toBeNull();
  });
});
