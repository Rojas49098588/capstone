// @vitest-environment jsdom
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NOW, dayKey } from "../planner/testData";
import { createProject, placeDecor, removeDecor } from "../store/actions";
import type { StudiumData } from "../planner/types";
import { buildSeed } from "../store/seed";
import { STORAGE_KEY } from "../store/storage";
import { renderWithStudium, savedData, withFocus } from "../test/render";
import ProjectDetail from "./ProjectDetail";

const props = { justHatched: false, onRequestComplete: vi.fn(), onEditProject: vi.fn(), onOpenShop: vi.fn() };

describe("ProjectDetail", () => {
  it("shows the project, its requirements and its habitat", () => {
    renderWithStudium(<ProjectDetail projectId="webDev" {...props} />);
    screen.getByRole("heading", { name: "Web Development Portfolio" });
    screen.getByRole("progressbar", { name: "Overall progress" });
    screen.getByRole("article", { name: "Case studies" });
    screen.getByRole("region", { name: "webDev habitat" });
  });

  it("adds a requirement", async () => {
    const { storage } = renderWithStudium(<ProjectDetail projectId="webDev" {...props} />);
    await userEvent.click(screen.getByRole("button", { name: "+ Add requirement" }));
    await userEvent.type(screen.getByLabelText("Requirement title"), "Blog");
    await userEvent.click(screen.getByRole("button", { name: "Add requirement" }));
    screen.getByRole("article", { name: "Blog" });
    expect(savedData(storage).requirements.some((r) => r.title === "Blog" && r.projectId === "webDev")).toBe(true);
  });

  it("shows the Unlinked group after unlinking a requirement's tasks", async () => {
    renderWithStudium(<ProjectDetail projectId="webDev" {...props} />);
    await userEvent.click(screen.getByRole("button", { name: "Delete Case studies" }));
    await userEvent.click(screen.getByRole("button", { name: "Move tasks to Unlinked" }));
    screen.getByRole("region", { name: "Unlinked tasks" });
  });

  it("explains what to do in an empty project", () => {
    const { data } = createProject(
      buildSeed(NOW),
      { name: "Blank", shortName: "blank", color: "#2d3a8c", deadline: dayKey(30), description: "", petKind: "cat" },
      NOW,
    );
    const id = data.projects[data.projects.length - 1].id;
    renderWithStudium(<ProjectDetail projectId={id} {...props} />, { data });
    screen.getByText(/No requirements yet/);
  });

  it("opens the project editor", async () => {
    const onEditProject = vi.fn();
    renderWithStudium(<ProjectDetail projectId="webDev" {...props} onEditProject={onEditProject} />);
    await userEvent.click(screen.getByRole("button", { name: "Edit project" }));
    expect(onEditProject).toHaveBeenCalled();
  });
});

describe("ProjectDetail focus time", () => {
  it("shows this week's focus time", () => {
    renderWithStudium(<ProjectDetail projectId="webDev" {...props} />, { data: withFocus(150) });
    screen.getByText("Focused this week: 2 h 30 min");
  });

  it("leaves out focus time from earlier weeks", () => {
    renderWithStudium(<ProjectDetail projectId="webDev" {...props} />, {
      data: withFocus(150, "webDev-t5", new Date(NOW.getTime() - 9 * 86_400_000)),
    });
    expect(screen.queryByText(/Focused this week/)).toBeNull();
  });
});

describe("ProjectDetail decor", () => {
  const owningBed = () => {
    const data: StudiumData = { ...buildSeed(NOW), decor: {} };
    data.events.push({ type: "purchase", at: NOW.toISOString(), productId: "pet-bed", price: 0 });
    return data;
  };
  const startPlacing = async () => {
    await userEvent.click(screen.getByRole("tab", { name: "Furniture" }));
    await userEvent.click(screen.getByRole("button", { name: "Place Pet Bed" }));
    screen.getByText("Placing Pet Bed: pick a free spot in the habitat.");
  };

  it("shows the inventory under the habitat", () => {
    renderWithStudium(<ProjectDetail projectId="webDev" {...props} />);
    screen.getByRole("region", { name: "Inventory" });
  });

  it("places from the inventory into a spot in the habitat", async () => {
    const { storage } = renderWithStudium(<ProjectDetail projectId="webDev" {...props} />, { data: owningBed() });
    await startPlacing();
    await userEvent.click(screen.getByRole("button", { name: "Put Pet Bed in the right floor spot" }));
    expect(savedData(storage).decor?.webDev).toEqual({ floorRight: "pet-bed" });
    expect(screen.queryByText(/^Placing /)).toBeNull();
    screen.getByRole("img", { name: "Pet Bed" });
  });

  it("Cancel and Escape stop placing", async () => {
    renderWithStudium(<ProjectDetail projectId="webDev" {...props} />, { data: owningBed() });
    await startPlacing();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText(/^Placing /)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Place Pet Bed" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByText(/^Placing /)).toBeNull();
    expect(screen.queryAllByRole("button", { name: /^Put / })).toHaveLength(0);
  });
});

describe("ProjectDetail Move here", () => {
  const owning = (...ids: string[]) => {
    const data: StudiumData = { ...buildSeed(NOW), decor: {} };
    for (const productId of ids) data.events.push({ type: "purchase", at: NOW.toISOString(), productId, price: 0 });
    return data;
  };

  it("moves the copy from the other habitat", async () => {
    const data = placeDecor(owning("clock"), "appDev", "wallLeft", "clock");
    const { storage } = renderWithStudium(<ProjectDetail projectId="webDev" {...props} />, { data });
    await userEvent.click(screen.getByRole("tab", { name: "Furniture" }));
    await userEvent.click(screen.getByRole("button", { name: "Move Clock here" }));
    await userEvent.click(screen.getByRole("button", { name: "Put Clock in the right wall spot" }));
    expect(savedData(storage).decor).toEqual({ webDev: { wallRight: "clock" } });
  });

  it("never moves a different item when the source changed in another tab", async () => {
    const data = placeDecor(owning("clock", "study-poster"), "appDev", "wallLeft", "clock");
    const { storage } = renderWithStudium(<ProjectDetail projectId="webDev" {...props} />, { data });
    await userEvent.click(screen.getByRole("tab", { name: "Furniture" }));
    await userEvent.click(screen.getByRole("button", { name: "Move Clock here" }));
    // Another tab takes the Clock down and hangs the Poster in its place.
    const other = placeDecor(removeDecor(data, "appDev", "wallLeft"), "appDev", "wallLeft", "study-poster");
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: JSON.stringify(other) }));
    });
    await userEvent.click(screen.getByRole("button", { name: "Put Clock in the right wall spot" }));
    // The free Clock is placed; the Poster stays where it is.
    expect(savedData(storage).decor).toEqual({ appDev: { wallLeft: "study-poster" }, webDev: { wallRight: "clock" } });
  });
});
