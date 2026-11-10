// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NOW } from "../planner/testData";
import type { StudiumData } from "../planner/types";
import * as A from "../store/actions";
import { buildSeed } from "../store/seed";
import { STORAGE_KEY } from "../store/storage";
import { liveRecords, type StampedRecords } from "../sync/merge";
import { fromRecords } from "../sync/records";
import { summarize } from "../sync/saveSummary";
import { loadSyncState } from "../sync/syncState";
import {
  ABBY,
  ACCOUNT_SAVED_AT,
  ProjectNames,
  accountHas,
  backupKeys,
  renderWithAccount,
  storageWithoutBackups,
} from "../test/account";
import { FakeRemote } from "../test/fakeRemote";
import { savedAtLabel } from "../ui/format";
import Settings from "./Settings";

/** The account: the example data plus a "Novel" project and one more task done, so it has more progress. */
function accountData(): StudiumData {
  let data = A.createProject(
    buildSeed(NOW),
    { name: "Novel", shortName: "Novel", color: "#7b4fa6", deadline: "2026-12-20", description: "", petKind: "cat" },
    NOW,
  ).data;
  const open = data.tasks.find((t) => !t.done);
  if (!open) throw new Error("the example data has an open task");
  data = A.completeTask(data, open.id, null, NOW).data;
  return data;
}

async function withPicker(o: { storage?: Storage } = {}) {
  const remote = new FakeRemote();
  await accountHas(remote, ABBY.uid, accountData());
  const r = renderWithAccount(
    <>
      <Settings />
      <ProjectNames />
    </>,
    { remote, signedIn: ABBY, storage: o.storage },
  );
  const picker = await screen.findByRole("dialog", { name: "You have two saves" });
  return { ...r, picker };
}

const stat = (card: HTMLElement, label: string) => within(card).getByText(label).parentElement?.querySelector("b")?.textContent;
const shownNames = () => within(screen.getByRole("list", { name: "Projects" })).getAllByRole("listitem").map((li) => li.textContent);

describe("SavePicker", () => {
  it("both devices have projects → the picker shows both cards with counts, pets, saved time and the More progress tag on the right one", async () => {
    const { picker, remote } = await withPicker();
    within(picker).getByText("The one you don't keep is saved as a backup file on this computer, just in case.");
    const local = within(picker).getByRole("region", { name: "On this computer" });
    const account = within(picker).getByRole("region", { name: "In your account" });
    const mine = summarize(buildSeed(NOW), null);
    // As the account holds it (records come back in their own order).
    const theirs = summarize(fromRecords(liveRecords((await remote.load(ABBY.uid)) as StampedRecords)).data, null);

    for (const [card, s] of [[local, mine], [account, theirs]] as const) {
      expect(stat(card, s.projects === 1 ? "project" : "projects")).toBe(String(s.projects));
      expect(stat(card, "tokens")).toBe(String(s.tokens));
      expect(stat(card, "tasks done")).toBe(String(s.tasksDone));
      expect(stat(card, s.petsGrownUp === 1 ? "pet grown up" : "pets grown up")).toBe(String(s.petsGrownUp));
      for (const p of s.pets) within(card).getByText(p.stage === "egg" ? "An egg" : p.name);
      if (s.more > 0) within(card).getByText(`+ ${s.more} more`);
    }
    within(account).getByText(savedAtLabel(ACCOUNT_SAVED_AT.toISOString(), NOW));
    within(account).getByText("Desktop app");
    within(local).getByText(/^Last saved/);
    within(account).getByText("More progress");
    expect(within(local).queryByText("More progress")).toBeNull();
    within(local).getByRole("button", { name: "Keep this computer's" });
    within(account).getByRole("button", { name: "Keep my account's" });
  });

  it("Keep my account's replaces local data and leaves a backup", async () => {
    const user = userEvent.setup();
    const { picker, storage } = await withPicker();
    expect(backupKeys(storage)).toEqual([]);
    await user.click(within(picker).getByRole("button", { name: "Keep my account's" }));
    await screen.findByText("Last synced just now");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(shownNames()).toContain("Novel");
    const [key] = backupKeys(storage);
    const backup = JSON.parse(storage.getItem(key) as string) as StudiumData;
    expect(backup.projects.map((p) => p.name)).toEqual(buildSeed(NOW).projects.map((p) => p.name));
    expect(loadSyncState(storage)).toMatchObject({ uid: ABBY.uid, owner: ABBY.uid });
  });

  it("after a choice, Settings → Account lists the backup with a Download button", async () => {
    const user = userEvent.setup();
    const { picker } = await withPicker();
    await user.click(within(picker).getByRole("button", { name: "Keep this computer's" }));
    await screen.findByText("Last synced just now");
    const section = screen.getByRole("region", { name: "Account" });
    within(section).getByText(/^Backup from /);
    within(section).getByRole("button", { name: "Download" });
    expect(shownNames()).not.toContain("Novel");
  });

  it("Not now (sign out) signs out and closes the picker, changing nothing here or in the account", async () => {
    const user = userEvent.setup();
    const { picker, auth, remote, storage } = await withPicker();
    const write = vi.spyOn(remote, "write");
    const replaceAll = vi.spyOn(remote, "replaceAll");
    const before = storage.getItem(STORAGE_KEY);
    await user.click(within(picker).getByRole("button", { name: "Not now (sign out)" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(auth.current()).toBeNull();
    expect(storage.getItem(STORAGE_KEY)).toBe(before);
    expect(shownNames()).not.toContain("Novel");
    expect(write).not.toHaveBeenCalled();
    expect(replaceAll).not.toHaveBeenCalled();
    expect(backupKeys(storage)).toEqual([]);
    screen.getByRole("button", { name: "Link account" });
  });

  it("Not now (sign out) still works while a choice hangs (offline)", async () => {
    const user = userEvent.setup();
    const { picker, auth, remote } = await withPicker();
    vi.spyOn(remote, "replaceAll").mockImplementation(() => new Promise(() => {})); // never answers
    await user.click(within(picker).getByRole("button", { name: "Keep this computer's" }));
    await user.click(within(picker).getByRole("button", { name: "Not now (sign out)" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(auth.current()).toBeNull();
    screen.getByRole("button", { name: "Link account" });
  });

  it("if the backup can't be written, says so, changes nothing and leaves the device signed out", async () => {
    const user = userEvent.setup();
    const { picker, auth } = await withPicker({ storage: storageWithoutBackups() });
    await user.click(within(picker).getByRole("button", { name: "Keep my account's" }));
    await within(picker).findByText("Studium couldn't save a backup on this computer, so nothing was changed.");
    expect(auth.current()).toBeNull();
    expect(shownNames()).not.toContain("Novel");
    await user.click(within(picker).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    screen.getByRole("button", { name: "Link account" });
  });
});
