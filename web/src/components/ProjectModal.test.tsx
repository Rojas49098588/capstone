// @vitest-environment jsdom
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NOW, dayKey } from "../planner/testData";
import { PET_KINDS } from "../planner/types";
import { buildSeed } from "../store/seed";
import { renderWithStudium, savedData, withEgg } from "../test/render";
import ProjectModal from "./ProjectModal";

const webDev = () => buildSeed(NOW).projects[0];

describe("ProjectModal", () => {
  it("requires a name, a deadline and an egg", async () => {
    const onCreated = vi.fn();
    renderWithStudium(<ProjectModal onClose={vi.fn()} onCreated={onCreated} />);
    await userEvent.click(screen.getByRole("button", { name: "Create project" }));
    screen.getByText("Add a project name.");
    screen.getByText("Pick a deadline.");
    screen.getByText("Choose an egg.");
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("creates a project with the chosen egg", async () => {
    const onCreated = vi.fn();
    const onClose = vi.fn();
    const { storage } = renderWithStudium(<ProjectModal onClose={onClose} onCreated={onCreated} />);
    await userEvent.type(screen.getByLabelText("Project name"), "Thesis Website");
    fireEvent.change(screen.getByLabelText("Deadline"), { target: { value: dayKey(40) } });
    await userEvent.click(screen.getAllByRole("radio", { name: /^Egg / })[2]);
    await userEvent.click(screen.getByRole("button", { name: "Create project" }));
    const created = savedData(storage).projects.find((p) => p.name === "Thesis Website");
    expect(created).toBeDefined();
    expect(PET_KINDS).toContain(created?.petKind);
    expect(created?.shortName).toBe("Thesis");
    expect(onCreated).toHaveBeenCalledWith(created);
    expect(onClose).toHaveBeenCalled();
  });

  it("the short name is asked for as the pet's nickname", async () => {
    const { storage } = renderWithStudium(<ProjectModal onClose={vi.fn()} onCreated={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Project name"), "Senior Capstone");
    await userEvent.type(screen.getByLabelText("Pet nickname"), "UI/UX");
    fireEvent.change(screen.getByLabelText("Deadline"), { target: { value: dayKey(40) } });
    await userEvent.click(screen.getAllByRole("radio", { name: /^Egg / })[0]);
    await userEvent.click(screen.getByRole("button", { name: "Create project" }));
    expect(savedData(storage).projects.find((p) => p.name === "Senior Capstone")?.shortName).toBe("UI/UX");
    expect(screen.queryByLabelText("Short label")).toBeNull();
  });

  it("edits a project without changing its pet", async () => {
    const { storage } = renderWithStudium(<ProjectModal project={webDev()} onClose={vi.fn()} />);
    screen.getByText(/Companion: pigeon/);
    expect(screen.queryAllByRole("radio", { name: /^Egg / })).toHaveLength(0);
    await userEvent.clear(screen.getByLabelText("Project name"));
    await userEvent.type(screen.getByLabelText("Project name"), "Portfolio Site");
    await userEvent.click(screen.getByRole("button", { name: "Save project" }));
    expect(savedData(storage).projects.find((p) => p.id === "webDev")).toMatchObject({ name: "Portfolio Site", petKind: "pigeon" });
  });

  it("a new project starts with the default type and difficulty from settings", async () => {
    const { storage } = renderWithStudium(<ProjectModal onClose={vi.fn()} />, { settings: { projectType: "writing", difficulty: "strict" } });
    expect(screen.getByRole("radio", { name: "Writing" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: "Strict" }).getAttribute("aria-checked")).toBe("true");
    await userEvent.type(screen.getByLabelText("Project name"), "Novel");
    fireEvent.change(screen.getByLabelText("Deadline"), { target: { value: dayKey(40) } });
    await userEvent.click(screen.getAllByRole("radio", { name: /^Egg / })[0]);
    await userEvent.click(screen.getByRole("button", { name: "Create project" }));
    expect(savedData(storage).projects.find((p) => p.name === "Novel")).toMatchObject({ type: "writing", difficulty: "strict" });
  });

  it("editing changes a project's type and difficulty", async () => {
    const { storage } = renderWithStudium(<ProjectModal project={webDev()} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("radio", { name: "Music" }));
    await userEvent.click(screen.getByRole("radio", { name: "Gentle" }));
    await userEvent.click(screen.getByRole("button", { name: "Save project" }));
    expect(savedData(storage).projects.find((p) => p.id === "webDev")).toMatchObject({ type: "music", difficulty: "gentle" });
  });

  it("editing an old project shows School and Steady, and saving without changes keeps it unset", async () => {
    const { storage } = renderWithStudium(<ProjectModal project={webDev()} onClose={vi.fn()} />, { settings: { projectType: "art", difficulty: "strict" } });
    expect(screen.getByRole("radio", { name: "School" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: "Steady" }).getAttribute("aria-checked")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "Save project" }));
    const saved = savedData(storage).projects.find((p) => p.id === "webDev");
    expect(saved && ("type" in saved || "difficulty" in saved)).toBe(false);
  });

  it("deletes a project after confirming", async () => {
    const onDeleted = vi.fn();
    const { storage } = renderWithStudium(<ProjectModal project={webDev()} onClose={vi.fn()} onDeleted={onDeleted} />);
    await userEvent.click(screen.getByRole("button", { name: "Delete project" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(savedData(storage).projects.some((p) => p.id === "webDev")).toBe(false);
    expect(onDeleted).toHaveBeenCalled();
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    renderWithStudium(<ProjectModal onClose={onClose} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});

describe("ProjectModal for an egg", () => {
  it("doesn't give away the animal or say it has hatched", () => {
    const { data, id } = withEgg(1);
    const egg = data.projects.find((p) => p.id === id)!;
    renderWithStudium(<ProjectModal project={egg} onClose={vi.fn()} />, { data });
    screen.getByText("Companion: an egg (it hatches once the project has 3 requirements).");
    expect(screen.queryByText(/cat/)).toBeNull();
    expect(screen.queryByText(/has hatched/)).toBeNull();
  });
});
