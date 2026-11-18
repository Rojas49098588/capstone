// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { dayKey, makeData, makeRequirement, makeTask } from "../planner/testData";
import { memoryStorage, renderWithStudium } from "../test/render";
import { formatDate } from "../ui/format";
import RequirementsSection from "./RequirementsSection";

// Prototype 9 is due tomorrow; Prototype 10 (sublabel Accessibility) waits on it and is due in 10 days;
// Prototype 11 is due in 20 days. "APK" is on today's list.
const data = () =>
  makeData({
    requirements: [
      makeRequirement({ id: "P9", title: "Prototype 9", dueDate: dayKey(1) }),
      makeRequirement({ id: "P10", title: "Prototype 10", dueDate: dayKey(10), blockedBy: ["P9"], sublabel: "Accessibility" }),
      makeRequirement({ id: "P11", title: "Prototype 11", dueDate: dayKey(20) }),
    ],
    tasks: [
      makeTask({ id: "c9", requirementId: "P9", title: "Commit 9" }),
      makeTask({ id: "c10", requirementId: "P10", title: "Commit 10" }),
      makeTask({ id: "apk", requirementId: "P10", title: "APK" }),
      makeTask({ id: "c11", requirementId: "P11", title: "Commit 11" }),
    ],
    today: { date: dayKey(0), taskIds: ["apk"] },
  });

const show = (storage = memoryStorage()) =>
  renderWithStudium(<RequirementsSection projectId="p1" onRequestComplete={vi.fn()} onHatch={vi.fn()} />, { data: data(), storage });
const card = (title: string) => screen.getByRole("article", { name: title });
const menuButton = () => screen.getByRole("button", { name: /^Requirements view/ });
const ROLE = (name: string) => (/^(Collapse|Expand) all$/.test(name) ? "menuitem" : name === "Show all" ? "menuitemradio" : "menuitemcheckbox");
async function pick(name: string) {
  if (menuButton().getAttribute("aria-expanded") !== "true") await userEvent.click(menuButton());
  await userEvent.click(screen.getByRole(ROLE(name), { name }));
}

describe("the condensed requirements view", () => {
  it("collapses a requirement to one line with its sublabel, due date and Waiting on", async () => {
    show();
    await userEvent.click(screen.getByRole("button", { name: "Collapse Prototype 10" }));
    const p10 = card("Prototype 10");
    expect(within(p10).queryByRole("progressbar")).toBeNull();
    expect(within(p10).queryByText("APK")).toBeNull();
    expect(within(p10).queryByRole("button", { name: "Edit Prototype 10" })).toBeNull();
    within(p10).getByText("Accessibility");
    within(p10).getByText(`Due ${formatDate(dayKey(10))}`);
    within(p10).getByText("Waiting on Prototype 9");
    await userEvent.click(screen.getByRole("button", { name: "Expand Prototype 10" }));
    within(card("Prototype 10")).getByText("APK");
  });

  it("Collapse all then Expand all from the ≡ menu", async () => {
    show();
    await pick("Collapse all");
    for (const t of ["Prototype 9", "Prototype 10", "Prototype 11"]) expect(within(card(t)).queryByRole("progressbar")).toBeNull();
    await userEvent.click(menuButton());
    expect(screen.queryByRole("menuitem", { name: "Collapse all" })).toBeNull();
    await userEvent.click(screen.getByRole("menuitem", { name: "Expand all" }));
    for (const t of ["Prototype 9", "Prototype 10", "Prototype 11"]) within(card(t)).getByRole("progressbar");
  });

  it("filters stack; Soon hides later requirements and says how many", async () => {
    show();
    await pick("Soon");
    // A filter keeps the menu open, so another can be added.
    expect(screen.getByRole("menuitemcheckbox", { name: "Soon" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("menuitemradio", { name: "Show all" }).getAttribute("aria-checked")).toBe("false");
    expect(menuButton().textContent).toBe("≡ Soon");
    card("Prototype 9");
    expect(screen.queryByRole("article", { name: "Prototype 10" })).toBeNull();
    screen.getByText("2 more hidden by Soon");
    await pick("Hide completed");
    expect(screen.getByRole("menuitemcheckbox", { name: "Soon" }).getAttribute("aria-checked")).toBe("true");
    expect(menuButton().textContent).toBe("≡ Hide completed + Soon");
    // Unticking one keeps the other.
    await pick("Soon");
    expect(menuButton().textContent).toBe("≡ Hide completed");
    card("Prototype 11");
    await pick("Soon");
    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("button", { name: "Show all" }));
    expect(menuButton().textContent).toBe("≡");
    card("Prototype 11");
  });

  it("Today's to-do and Hide completed together show today's unfinished tasks", async () => {
    const d = data();
    d.tasks.push(makeTask({ id: "done9", requirementId: "P9", title: "Done 9", done: true }));
    d.today.taskIds.push("done9");
    renderWithStudium(<RequirementsSection projectId="p1" onRequestComplete={vi.fn()} onHatch={vi.fn()} />, { data: d, storage: memoryStorage() });
    await pick("Today's to-do");
    within(card("Prototype 9")).getByText("Done 9");
    await pick("Hide completed");
    expect(screen.queryByRole("article", { name: "Prototype 9" })).toBeNull();
    within(card("Prototype 10")).getByText("APK");
    await pick("Show all");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(menuButton().textContent).toBe("≡");
  });

  it("Today's to-do shows only today's tasks", async () => {
    show();
    await pick("Today's to-do");
    const p10 = card("Prototype 10");
    within(p10).getByText("APK");
    expect(within(p10).queryByText("Commit 10")).toBeNull();
    expect(within(p10).queryByRole("button", { name: "Move APK up" })).toBeNull();
    expect(screen.queryByRole("article", { name: "Prototype 9" })).toBeNull();
    screen.getByText("2 more hidden by Today's to-do");
  });

  it("empty Soon says Nothing due in the next 3 days.", async () => {
    const storage = memoryStorage();
    const d = data();
    d.requirements[0].dueDate = dayKey(9);
    renderWithStudium(<RequirementsSection projectId="p1" onRequestComplete={vi.fn()} onHatch={vi.fn()} />, { data: d, storage });
    await pick("Soon");
    screen.getByText("Nothing due in the next 3 days.");
    await userEvent.click(screen.getByRole("button", { name: "Show all" }));
    card("Prototype 9");
  });

  it("the view and collapsed requirements are remembered on this device", async () => {
    const storage = memoryStorage();
    const first = show(storage);
    await userEvent.click(screen.getByRole("button", { name: "Collapse Prototype 9" }));
    await pick("Soon");
    first.unmount();
    show(storage);
    expect(menuButton().textContent).toBe("≡ Soon");
    screen.getByRole("button", { name: "Expand Prototype 9" });
  });

  it("the menu works from the keyboard and Esc returns focus", async () => {
    show();
    menuButton().focus();
    await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Collapse all" }));
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(screen.getByRole("menuitemradio", { name: "Show all" }));
    await userEvent.keyboard("{ArrowUp}{ArrowUp}");
    expect(document.activeElement).toBe(screen.getByRole("menuitemcheckbox", { name: "Soon" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(menuButton());
  });

  it("a project with no requirements always shows its Unlinked tasks, whatever view was saved", () => {
    const storage = memoryStorage();
    storage.setItem("studium.requirementView.p1", JSON.stringify({ view: "soon", collapsed: [] }));
    const d = makeData({ tasks: [makeTask({ id: "u", requirementId: null, title: "Email advisor" })] });
    renderWithStudium(<RequirementsSection projectId="p1" onRequestComplete={vi.fn()} onHatch={vi.fn()} />, { data: d, storage });
    screen.getByText("Email advisor");
  });

  it("a card with an open form stays open, so Collapse all never throws away typing", async () => {
    show();
    await userEvent.click(within(card("Prototype 11")).getByRole("button", { name: "+ Add task" }));
    expect((screen.getByRole("button", { name: "Collapse Prototype 11" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.type(within(card("Prototype 11")).getAllByRole("textbox")[0], "Half typed");
    await pick("Collapse all");
    expect((within(card("Prototype 11")).getAllByRole("textbox")[0] as HTMLInputElement).value).toBe("Half typed");
    expect(within(card("Prototype 9")).queryByRole("progressbar")).toBeNull();
  });
});
