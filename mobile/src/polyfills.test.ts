// Phones (Hermes) have no global crypto, which the shared code uses for new ids (store/actions.ts newId).
jest.mock("expo-crypto", () => ({ randomUUID: () => require("node:crypto").randomUUID() }));

const realCrypto = globalThis.crypto;
afterEach(() => Object.defineProperty(globalThis, "crypto", { value: realCrypto, configurable: true, writable: true }));

test("a quick add works on a phone, which has no crypto of its own", () => {
  Object.defineProperty(globalThis, "crypto", { value: undefined, configurable: true, writable: true });
  jest.isolateModules(() => {
    require("./polyfills");
    const { createPendingTask } = require("@shared/store/actions");
    const { buildSeed } = require("@shared/store/seed");
    const data = buildSeed(new Date());
    const { task } = createPendingTask(data, { projectId: data.projects[0].id, title: "Email TA", addToToday: true }, new Date());
    expect(task.id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
