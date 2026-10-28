// @vitest-environment jsdom
import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { dayKey } from "./planner/testData";
import { StudiumApp } from "./App";
import { renderWithStudium, savedData } from "./test/render";
import { NOW } from "./planner/testData";
import { emptyData } from "./store/seed";

// These render the whole app; the first one also pays the file's cold start, which can pass 5 s
// when the full suite runs in parallel on a busy machine.
describe("StudiumApp", { timeout: 15_000 }, () => {
  it("navigates between overview, a project and the shop", async () => {
    renderWithStudium(<StudiumApp />);
    screen.getByRole("heading", { name: "Your Projects" });
    await userEvent.click(screen.getAllByRole("button", { name: /appDev/ })[0]);
    screen.getByRole("heading", { name: "Mobile App — Habit Tracker" });
    await userEvent.click(screen.getAllByRole("button", { name: "Shop" })[0]);
    screen.getByRole("heading", { name: "Shop" });
    await userEvent.click(screen.getAllByRole("button", { name: "All Projects" })[0]);
    screen.getByRole("heading", { name: "Your Projects" });
  });

  it("a new user who finished setup is asked to create a first project", async () => {
    renderWithStudium(<StudiumApp />, { data: emptyData(NOW) });
    const prompt = screen.getByRole("dialog", { name: "Create your first project" });
    await userEvent.click(within(prompt).getByRole("button", { name: "Create my first project" }));
    expect(screen.queryByRole("dialog", { name: "Create your first project" })).toBeNull();
    screen.getByLabelText("Project name");
  });

  it("Not now closes the first-project prompt, and it returns when the Overview opens again", async () => {
    renderWithStudium(<StudiumApp />, { data: emptyData(NOW) });
    await userEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.queryByRole("dialog", { name: "Create your first project" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Settings" }));
    await userEvent.click(screen.getAllByRole("button", { name: "All Projects" })[0]);
    screen.getByRole("dialog", { name: "Create your first project" });
  });

  it("never shows the first-project prompt before setup or once a project exists", () => {
    const { unmount } = renderWithStudium(<StudiumApp />, { data: emptyData(NOW), settings: { setupDone: false } });
    expect(screen.queryByRole("dialog", { name: "Create your first project" })).toBeNull();
    unmount();
    renderWithStudium(<StudiumApp />);
    expect(screen.queryByRole("dialog", { name: "Create your first project" })).toBeNull();
  });

  it("shows setup first for someone who hasn't done it", () => {
    renderWithStudium(<StudiumApp />, { settings: { setupDone: false } });
    screen.getByRole("heading", { name: "What do you make?" });
    expect(screen.queryByRole("heading", { name: "Your Projects" })).toBeNull();
  });

  it("an existing user with projects sees setup once, then their Overview, with no tutorial", async () => {
    const { storage } = renderWithStudium(<StudiumApp />, { settings: { setupDone: false } });
    for (let i = 0; i < 3; i++) await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await userEvent.click(screen.getByRole("button", { name: "Start using Studium" }));
    screen.getByRole("heading", { name: "Your Projects" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(JSON.parse(storage?.getItem("studium-settings-v1") as string)).toMatchObject({ setupDone: true, tutorialDone: true });
  });

  it("reloading mid-setup starts setup again", async () => {
    const { storage, unmount } = renderWithStudium(<StudiumApp />, { settings: { setupDone: false } });
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    screen.getByText("Step 2 of 4");
    unmount();
    renderWithStudium(<StudiumApp />, { storage });
    screen.getByText("Step 1 of 4");
  });

  it("the gear button opens User Settings", async () => {
    renderWithStudium(<StudiumApp />);
    await userEvent.click(screen.getByRole("button", { name: "Settings" }));
    screen.getByRole("heading", { name: "User Settings" });
    await userEvent.click(screen.getAllByRole("button", { name: "All Projects" })[0]);
    screen.getByRole("heading", { name: "Your Projects" });
  });

  it("completes from Today, then reopens on the project page", async () => {
    const { storage } = renderWithStudium(<StudiumApp />);
    await userEvent.click(screen.getByRole("checkbox", { name: "Complete Write case study #3" }));
    await userEvent.click(screen.getByRole("button", { name: "Save and complete" }));
    expect(screen.getByRole("status").textContent).toMatch(/\+\d+ tokens/);
    const balanceAfter = savedData(storage).events.filter((e) => e.type === "task_completed").length;
    await userEvent.click(screen.getAllByRole("button", { name: /webDev/ })[0]);
    await userEvent.click(screen.getByRole("checkbox", { name: "Reopen Write case study #3" }));
    expect(savedData(storage).tasks.find((t) => t.id === "webDev-t5")?.done).toBe(false);
    expect(savedData(storage).events.filter((e) => e.type === "task_completed").length).toBe(balanceAfter);
  });

  it("creates a project that starts as an egg", async () => {
    renderWithStudium(<StudiumApp />);
    await userEvent.click(screen.getByRole("button", { name: "+ New Project" }));
    await userEvent.type(screen.getByLabelText("Project name"), "Thesis Website");
    fireEvent.change(screen.getByLabelText("Deadline"), { target: { value: dayKey(40) } });
    await userEvent.click(screen.getAllByRole("radio", { name: /^Egg / })[0]);
    await userEvent.click(screen.getByRole("button", { name: "Create project" }));
    screen.getByRole("heading", { name: "Thesis Website" });
    screen.getByText("Add 3 more requirements to hatch");
  });

  it("returns to the overview when the open project is deleted", async () => {
    renderWithStudium(<StudiumApp />);
    await userEvent.click(screen.getAllByRole("button", { name: /webDev/ })[0]);
    await userEvent.click(screen.getByRole("button", { name: "Edit project" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete project" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    screen.getByRole("heading", { name: "Your Projects" });
  });

  it("warns when changes can't be saved", async () => {
    renderWithStudium(<StudiumApp />, { storage: null });
    const alert = screen.getByRole("alert");
    within(alert).getByText(/won't be saved/);
    await userEvent.click(within(alert).getByRole("button", { name: "Dismiss notice" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the token balance in the header", () => {
    renderWithStudium(<StudiumApp />);
    screen.getByText("650 tokens");
  });
});

describe("StudiumApp keyboard focus", () => {
  it("moves focus into the project modal and back to its opener", async () => {
    renderWithStudium(<StudiumApp />);
    const opener = screen.getByRole("button", { name: "+ New Project" });
    await userEvent.click(opener);
    expect(document.activeElement).toBe(screen.getByLabelText("Project name"));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByLabelText("Project name")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("returns focus to the task after the completion prompt closes", async () => {
    renderWithStudium(<StudiumApp />);
    const box = screen.getByRole("checkbox", { name: "Complete Write case study #3" });
    await userEvent.click(box);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(document.activeElement).toBe(box);
  });
});

describe("StudiumApp switching projects", () => {
  it("doesn't carry a half-filled form or the habitat box to another project", async () => {
    renderWithStudium(<StudiumApp />);
    await userEvent.click(screen.getAllByRole("button", { name: /webDev/ })[0]);
    const box = document.querySelector("[data-pet-habitat]");
    box?.setAttribute("data-pet-attached", "");
    await userEvent.click(screen.getByRole("button", { name: "+ Add requirement" }));
    await userEvent.type(screen.getByLabelText("Requirement title"), "Typed for webDev");
    await userEvent.click(screen.getAllByRole("button", { name: /appDev/ })[0]);
    screen.getByRole("heading", { name: "Mobile App — Habit Tracker" });
    expect(screen.queryByLabelText("Requirement title")).toBeNull();
    const appBox = document.querySelector("[data-pet-habitat]");
    expect(appBox?.getAttribute("data-pet-habitat")).toBe("appDev");
    expect(appBox?.hasAttribute("data-pet-attached")).toBe(false);
  });
});

describe("StudiumApp links from the pets", () => {
  afterEach(() => history.replaceState(null, "", "/"));
  const open = (hash: string) => {
    history.replaceState(null, "", `/${hash}`);
    return renderWithStudium(<StudiumApp />);
  };

  it("#project=<id> opens that project and clears the hash", () => {
    open("#project=webDev");
    screen.getByRole("heading", { name: "Web Development Portfolio" });
    expect(location.hash).toBe("");
  });

  it("an unknown project stays on the overview", () => {
    open("#project=nope");
    screen.getByRole("heading", { name: "Your Projects" });
    expect(location.hash).toBe("");
  });

  it("#complete=<taskId> opens the project and its completion prompt", () => {
    open("#complete=webDev-t5");
    screen.getByRole("heading", { name: "Web Development Portfolio" });
    screen.getByRole("dialog", { name: 'About how long did "Write case study #3" take?' });
  });

  it("#complete for a done or blocked task only opens the project", () => {
    open("#complete=webDev-t3");
    screen.getByRole("heading", { name: "Web Development Portfolio" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("#complete for a blocked task only opens the project", () => {
    open("#complete=webDev-t8");
    screen.getByRole("heading", { name: "Web Development Portfolio" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("an unknown task does nothing", () => {
    open("#complete=nope");
    screen.getByRole("heading", { name: "Your Projects" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("follows links that arrive later", () => {
    open("");
    act(() => {
      history.replaceState(null, "", "/#project=appDev");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    screen.getByRole("heading", { name: "Mobile App — Habit Tracker" });
    expect(location.hash).toBe("");
  });
});
