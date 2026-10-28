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

  it("edits a project without changing its pet", async () => {
    const { storage } = renderWithStudium(<ProjectModal project={webDev()} onClose={vi.fn()} />);
    screen.getByText(/Companion: pigeon/);
    expect(screen.queryAllByRole("radio", { name: /^Egg / })).toHaveLength(0);
    await userEvent.clear(screen.getByLabelText("Project name"));
    await userEvent.type(screen.getByLabelText("Project name"), "Portfolio Site");
    await userEvent.click(screen.getByRole("button", { name: "Save project" }));
    expect(savedData(storage).projects.find((p) => p.id === "webDev")).toMatchObject({ name: "Portfolio Site", petKind: "pigeon" });
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
