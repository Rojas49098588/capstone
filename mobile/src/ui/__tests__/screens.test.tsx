import { needsYou, petGroups, todayRows } from "@shared/companion/view";
import type { StudiumData, StudiumEvent } from "@shared/planner/types";
import { buildSeed, emptyData } from "@shared/store/seed";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import type { PhoneStudium } from "../../phoneStudium";
import { FakeAuth } from "@shared/test/fakeAuth";
import { FakeRemote } from "@shared/test/fakeRemote";
import { NOW, accountData, phone as makePhone, signedInPhone } from "../../testing/phoneFixture";
import PetsScreen, { NO_PETS_LINE } from "../PetsScreen";
import { PhoneProvider, TICK_MS } from "../PhoneContext";
import Root from "../Root";
import SettingsScreen from "../SettingsScreen";
import TodayScreen from "../TodayScreen";

const HOUR = 3_600_000;

function show(phone: PhoneStudium, node: React.ReactElement) {
  return render(<PhoneProvider phone={phone}>{node}</PhoneProvider>);
}

/** Seed data with today's first open, unblocked task, and nothing in Pending. */
function seeded(): StudiumData {
  return buildSeed(NOW);
}

describe("Pets", () => {
  test("shows each project and one card per pet, with the mood the planner gives", async () => {
    const { phone } = await signedInPhone(seeded());
    await show(phone, <PetsScreen />);
    const groups = petGroups(phone.state().data, phone.state().now);
    for (const g of groups) {
      screen.getByText(g.heading);
      for (const p of g.pets) if (p.mood) screen.getAllByLabelText(`${p.name}, ${p.mood}`);
    }
  });

  test("lists what needs the desktop, in order, only when there is something", async () => {
    const { phone } = await signedInPhone(seeded());
    await show(phone, <PetsScreen />);
    const needs = needsYou(phone.state().data, phone.state().now);
    if (needs.length === 0) expect(screen.queryByText("Needs you on the desktop")).toBeNull();
    else for (const n of needs) screen.getByText(n.text);
  });

  test("an empty account says how to get pets, and quick add is off", async () => {
    const { phone } = await signedInPhone(null);
    await show(phone, <PetsScreen />);
    screen.getByText(NO_PETS_LINE);
    await show(phone, <TodayScreen />);
    screen.getByText(NO_PETS_LINE);
    expect(screen.queryByLabelText("Task name")).toBeNull();
  });

  test("the food line moves on as time passes while the app is open", async () => {
    let now = NOW;
    const data = seeded();
    const project = data.projects[0];
    const events: StudiumEvent[] = [
      { type: "purchase", at: new Date(NOW.getTime() - 24 * HOUR).toISOString(), productId: "power-bento", price: 0 },
      { type: "fed", at: new Date(NOW.getTime() - 3 * HOUR).toISOString(), projectId: project.id, petId: project.id, productId: "power-bento" },
    ];
    const { phone } = await signedInPhone({ ...data, events: [...data.events, ...events] }, () => now);
    jest.useFakeTimers();
    try {
      await show(phone, <PetsScreen />);
      screen.getAllByText("Meal: × 1.1 tokens for 1h 0m more");
      now = new Date(NOW.getTime() + 2 * HOUR);
      await act(async () => {
        jest.advanceTimersByTime(TICK_MS);
      });
      expect(screen.queryByText("Meal: × 1.1 tokens for 1h 0m more")).toBeNull();
      screen.getAllByText("Next meal tomorrow");
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("Today", () => {
  const openRow = (phone: PhoneStudium) => todayRows(phone.state().data, phone.state().now).find((r) => !r.done && !r.blocked)!;

  test("ticking a task and skipping the time records it with no actual minutes", async () => {
    const { phone, remote } = await signedInPhone(seeded());
    const row = openRow(phone);
    await show(phone, <TodayScreen />);
    await fireEvent.press(screen.getByLabelText(`Complete ${row.title}`));
    screen.getByText("How long did it take?");
    await fireEvent.press(screen.getByText("Skip"));
    await act(() => phone.flush());
    expect((await accountData(remote)).tasks.find((t) => t.id === row.taskId)).toMatchObject({ done: true, actualMin: null });
  });

  test("Done records the time picked, prefilled with the estimate", async () => {
    const { phone, remote } = await signedInPhone(seeded());
    const row = openRow(phone);
    await show(phone, <TodayScreen />);
    await fireEvent.press(screen.getByLabelText(`Complete ${row.title}`));
    await fireEvent.press(screen.getByText("Done"));
    await act(() => phone.flush());
    expect((await accountData(remote)).tasks.find((t) => t.id === row.taskId)).toMatchObject({ done: true, actualMin: row.estimateMin });
  });

  test("quick add puts a task in Pending, and on today's plan only when asked", async () => {
    const { phone, remote } = await signedInPhone(seeded());
    await show(phone, <TodayScreen />);
    await fireEvent.changeText(screen.getByLabelText("Task name"), "Email TA");
    await fireEvent.press(screen.getByLabelText("Add"));
    await fireEvent.changeText(screen.getByLabelText("Task name"), "Book room");
    await fireEvent(screen.getByLabelText("Also add to today"), "valueChange", true);
    await fireEvent.press(screen.getByLabelText("Add"));
    await act(() => phone.flush());
    const account = await accountData(remote);
    const email = account.tasks.find((t) => t.title === "Email TA")!;
    const room = account.tasks.find((t) => t.title === "Book room")!;
    expect(email.pending && room.pending).toBe(true);
    expect(account.today.taskIds).toContain(room.id);
    expect(account.today.taskIds).not.toContain(email.id);
    screen.getByText("Email TA");
    screen.getByText("Book room");
  });

  test("quick add needs a name", async () => {
    const { phone } = await signedInPhone(seeded());
    const before = phone.state().data.tasks.length;
    await show(phone, <TodayScreen />);
    await fireEvent.press(screen.getByLabelText("Add"));
    screen.getByText("Give the task a name.");
    expect(phone.state().data.tasks.length).toBe(before);
  });
});

describe("Settings and signing in", () => {
  test("a wrong password says so in the desktop's words", async () => {
    const auth = new FakeAuth();
    auth.fail("signInEmail", "wrong-password");
    const p = makePhone(new FakeRemote(), () => NOW, auth);
    await show(p, <Root>{null}</Root>);
    await fireEvent.changeText(screen.getByLabelText("Email"), "abby@example.com");
    await fireEvent.changeText(screen.getByLabelText("Password"), "nope");
    await act(async () => {
      fireEvent.press(screen.getByText("Sign in"));
    });
    screen.getByText("That password isn't right.");
  });

  test("signing out with changes not yet uploaded asks first", async () => {
    const { phone, remote } = await signedInPhone(seeded());
    jest.spyOn(remote, "write").mockImplementation(() => new Promise<void>(() => undefined)); // offline: never acknowledged
    phone.quickAdd({ projectId: phone.state().data.projects[0].id, title: "Held", addToToday: false });
    await show(phone, <Root><SettingsScreen /></Root>);
    screen.getByText("Some changes haven't reached your account yet.");
    await fireEvent.press(screen.getByText("Sign out"));
    screen.getByText("Signing out now loses them. Sign out anyway?");
    expect(phone.state().account).not.toBeNull();
    await act(async () => {
      fireEvent.press(screen.getByText("Sign out anyway"));
    });
    screen.getByLabelText("Email");
  });

  test("shows the account, and signing out goes back to Sign in", async () => {
    const { phone } = await signedInPhone(seeded());
    await show(
      phone,
      <Root>
        <SettingsScreen />
      </Root>,
    );
    screen.getByText("abby@example.com");
    await act(async () => {
      fireEvent.press(screen.getByText("Sign out"));
    });
    screen.getByLabelText("Email");
    expect(phone.state().data).toMatchObject({ projects: emptyData(NOW).projects });
  });
});
