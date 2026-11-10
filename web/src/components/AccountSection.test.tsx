// @vitest-environment jsdom
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { buildSeed } from "../store/seed";
import { NOW } from "../planner/testData";
import { loadSyncState } from "../sync/syncState";
import { ABBY, ProjectNames, renderWithAccount, submitSignIn } from "../test/account";
import { FakeAuth } from "../test/fakeAuth";
import { FakeRemote } from "../test/fakeRemote";
import { renderWithStudium, savedData } from "../test/render";
import { AccountProvider } from "../sync/AccountProvider";
import { liveRecords, type StampedRecords } from "../sync/merge";
import { fromRecords } from "../sync/records";
import Settings from "./Settings";

const BONUS = "Link an account to save your progress and get a bonus later.";
const seedNames = buildSeed(NOW).projects.map((p) => p.name);
const shownNames = () => within(screen.getByRole("list", { name: "Projects" })).getAllByRole("listitem").map((li) => li.textContent);

describe("Settings → Account", () => {
  it("with accounts off, the Account section shows no Link account button", () => {
    renderWithAccount(<Settings />, { auth: null, remote: null });
    expect(screen.queryByRole("button", { name: "Link account" })).toBeNull();
    expect(screen.queryByText(BONUS)).toBeNull();
    screen.getByText("Your account details will show here once accounts are added.");
  });

  it("a guest sees Link account and the bonus line; signing in with email links and shows the email and Last synced", async () => {
    const user = userEvent.setup();
    const { remote } = renderWithAccount(<Settings />);
    screen.getByText(BONUS);
    await user.click(screen.getByRole("button", { name: "Link account" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("tab", { name: "Sign in" }));
    await submitSignIn(user, "abby@example.com", "secret1");
    await screen.findByText("Last synced just now");
    screen.getByText("abby@example.com");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button", { name: "Link account" })).toBeNull();
    expect(await remote.load("u-abby@example.com")).not.toBeNull(); // this device's projects went up
  });

  it("Sign out keeps the projects on screen and shows Link account again", async () => {
    const user = userEvent.setup();
    const { auth } = renderWithAccount(
      <>
        <Settings />
        <ProjectNames />
      </>,
      { signedIn: ABBY },
    );
    await screen.findByText("Last synced just now");
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    await screen.findByRole("button", { name: "Link account" });
    expect(auth.current()).toBeNull();
    expect(shownNames()).toEqual(seedNames);
  });

  it("Delete account asks to confirm, then removes cloud data and leaves the device as a guest", async () => {
    const user = userEvent.setup();
    const { remote, storage } = renderWithAccount(<Settings />, { signedIn: ABBY });
    await screen.findByText("Last synced just now");
    expect(await remote.load("u1")).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Delete account" }));
    screen.getByText("Delete your account? Your projects stay on this computer.");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Delete your account? Your projects stay on this computer.")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Delete account" }));
    await user.click(screen.getByRole("button", { name: "Delete account" }));
    await screen.findByRole("button", { name: "Link account" });
    expect(await remote.load("u1")).toBeNull();
    expect(loadSyncState(storage)).toMatchObject({ uid: null, owner: null });
    expect(savedData(storage).projects.map((p) => p.name)).toEqual(seedNames);
  });

  it("Delete account that needs a recent sign-in asks to sign in again", async () => {
    const user = userEvent.setup();
    const { auth, remote } = renderWithAccount(<Settings />, { signedIn: ABBY });
    await screen.findByText("Last synced just now");
    auth.fail("deleteAccount", "needs-recent-sign-in");
    await user.click(screen.getByRole("button", { name: "Delete account" }));
    await user.click(screen.getByRole("button", { name: "Delete account" }));
    await screen.findByText("For your security, sign in again, then delete.");
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("tab", { name: "Sign in" }).getAttribute("aria-selected")).toBe("true");
    expect(auth.current()).toEqual(ABBY); // still signed in: nothing was deleted from the account's sign-in
    // The account's data was put back while the person signs in again.
    await waitFor(async () => expect(await remote.load("u1")).not.toBeNull());
  });

  it("Delete account whose cloud delete fails part-way stays signed in, says so and puts the data back", async () => {
    const user = userEvent.setup();
    const { auth, remote } = renderWithAccount(<Settings />, { signedIn: ABBY });
    await screen.findByText("Last synced just now");
    const deleteAll = remote.deleteAll.bind(remote);
    vi.spyOn(remote, "deleteAll").mockImplementationOnce(async (uid) => {
      await deleteAll(uid); // some (here: all) of it went before the connection dropped
      throw new Error("network");
    });
    await user.click(screen.getByRole("button", { name: "Delete account" }));
    await user.click(screen.getByRole("button", { name: "Delete account" }));
    await screen.findByText("Something went wrong. Try again.");
    expect(auth.current()).toEqual(ABBY);
    await waitFor(async () => expect((await remote.load("u1"))?.projects).toBeTruthy());
    const back = fromRecords(liveRecords((await remote.load("u1")) as StampedRecords)).data;
    expect(back.projects.map((p) => p.name).sort()).toEqual([...seedNames].sort());
    screen.getByRole("button", { name: "Delete account" });
  });

  it("can't reach the cloud at launch: stays signed in, says so, and connects once back online", async () => {
    const remote = new FakeRemote();
    vi.spyOn(remote, "load").mockRejectedValueOnce(new Error("offline"));
    const { auth, storage } = renderWithAccount(<Settings />, { signedIn: ABBY, remote });
    await screen.findByText("Couldn't reach Studium's servers. Check your connection.");
    expect(auth.current()).toEqual(ABBY);
    screen.getByText("abby@example.com");
    expect(loadSyncState(storage).uid).toBe("u1");
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    await screen.findByText("Last synced just now");
    expect(screen.queryByText("Couldn't reach Studium's servers. Check your connection.")).toBeNull();
    expect(await remote.load("u1")).not.toBeNull();
  });

  it("a sync listener that stops says so, and connects again once back online", async () => {
    const remote = new FakeRemote();
    const { auth } = renderWithAccount(<Settings />, { signedIn: ABBY, remote });
    await screen.findByText("Last synced just now");
    const subscribe = vi.spyOn(remote, "subscribe");
    act(() => remote.failListeners("u1", new Error("permission-denied")));
    await screen.findByText("Couldn't reach Studium's servers. Check your connection.");
    expect(auth.current()).toEqual(ABBY);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    await waitFor(() => expect(screen.queryByText("Couldn't reach Studium's servers. Check your connection.")).toBeNull());
    expect(subscribe).toHaveBeenCalledTimes(1);
  });

  it("while Firebase is loading, the account buttons wait", async () => {
    let finish: (s: { auth: FakeAuth; remote: FakeRemote }) => void = () => {};
    const load = () => new Promise<{ auth: FakeAuth; remote: FakeRemote }>((resolve) => (finish = resolve));
    renderWithStudium(
      <AccountProvider load={load}>
        <Settings />
      </AccountProvider>,
    );
    expect((screen.getByRole("button", { name: "Link account" }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => finish({ auth: new FakeAuth(), remote: new FakeRemote() }));
    expect((screen.getByRole("button", { name: "Link account" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
