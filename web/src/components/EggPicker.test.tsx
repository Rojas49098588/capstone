// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { PET_KINDS, type PetKind } from "../planner/types";
import { EGGS, shuffledEggs } from "../pets/eggs";
import "../test/render";
import EggPicker from "./EggPicker";

describe("EggPicker", () => {
  it("shows a vague description for the chosen egg", async () => {
    const onChange = vi.fn();
    render(<EggPicker value={null} onChange={onChange} eggs={EGGS} />);
    const eggs = screen.getAllByRole("radio");
    expect(eggs).toHaveLength(5);
    await userEvent.click(eggs[0]);
    expect(onChange).toHaveBeenCalledWith(EGGS[0].kind);
    screen.getByText(EGGS[0].description);
  });

  it("moves between eggs with the arrow keys", async () => {
    function Harness() {
      const [value, setValue] = useState<PetKind | null>(null);
      return <EggPicker value={value} onChange={setValue} eggs={EGGS} />;
    }
    render(<Harness />);
    await userEvent.click(screen.getAllByRole("radio")[0]);
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getAllByRole("radio")[1].getAttribute("aria-checked")).toBe("true");
    screen.getByText(EGGS[1].description);
  });

  it("never names the animal", () => {
    render(<EggPicker value={null} onChange={() => {}} eggs={EGGS} />);
    const visible = (document.body.textContent ?? "").toLowerCase();
    const names = screen.getAllByRole("radio").map((egg) => (egg.getAttribute("aria-label") ?? "").toLowerCase());
    for (const kind of PET_KINDS) {
      expect(visible).not.toContain(kind);
      for (const name of names) expect(name).not.toContain(kind);
    }
    for (const egg of EGGS) for (const kind of PET_KINDS) expect(egg.description.toLowerCase()).not.toContain(kind);
  });

  it("shuffles into a different order without losing eggs", () => {
    const a = shuffledEggs(() => 0).map((e) => e.kind);
    const b = shuffledEggs(() => 0.999).map((e) => e.kind);
    expect([...a].sort()).toEqual([...PET_KINDS].sort());
    expect(a).not.toEqual(b);
  });
});
