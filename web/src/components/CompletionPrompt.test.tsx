// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithStudium, savedData } from "../test/render";
import CompletionPrompt from "./CompletionPrompt";

const find = (storage: Storage | null) => savedData(storage).tasks.find((t) => t.id === "webDev-t5");

describe("CompletionPrompt", () => {
  it("completes with the chosen time and reports the tokens", async () => {
    const onDone = vi.fn();
    const onClose = vi.fn();
    const { storage } = renderWithStudium(<CompletionPrompt taskId="webDev-t5" onClose={onClose} onDone={onDone} />);
    screen.getByRole("dialog", { name: 'About how long did "Write case study #3" take?' });
    // The 180-minute estimate isn't a quick choice, so it's pre-filled in the minutes box.
    expect((screen.getByLabelText("Time taken in minutes") as HTMLInputElement).value).toBe("180");
    await userEvent.click(screen.getByRole("radio", { name: "4 h" }));
    await userEvent.click(screen.getByRole("button", { name: "Save and complete" }));
    expect(find(storage)).toMatchObject({ done: true, actualMin: 240 });
    expect(onDone.mock.calls[0][0]).toMatch(/^\+\d+ tokens/);
    expect(onClose).toHaveBeenCalled();
  });

  it("can skip the time", async () => {
    const { storage } = renderWithStudium(<CompletionPrompt taskId="webDev-t5" onClose={vi.fn()} onDone={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(find(storage)).toMatchObject({ done: true, actualMin: null });
  });

  it("cancels without completing, also with Escape", async () => {
    const onClose = vi.fn();
    const { storage } = renderWithStudium(<CompletionPrompt taskId="webDev-t5" onClose={onClose} onDone={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(find(storage)?.done).toBe(false);
  });
});
