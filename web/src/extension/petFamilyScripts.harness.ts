// A fake chrome.* for running extension/content/pet.js in a test, shared by the pet family script tests.
type Listener = (changes: Record<string, { newValue: unknown }>, area: string) => void;

/** A first pet (petId = projectId) or, with `petId`, a pet bought for that project. */
export const familyPet = (projectId: string, petId = projectId) => ({
  projectId, petId, shortName: petId, name: projectId, color: "#2d3a8c", petKind: "cat", mood: "Happy",
  recovering: false, idleRequirement: null, suggestion: null, celebration: null, furniture: [],
});

export function fakeChrome(store: Record<string, unknown>) {
  const messages: unknown[] = [];
  const listeners: Listener[] = [];
  const set = async (v: Record<string, unknown>) => {
    Object.assign(store, v);
    const changes = Object.fromEntries(Object.entries(v).map(([k, newValue]) => [k, { newValue }]));
    listeners.forEach((f) => f(changes, "local"));
  };
  (globalThis as unknown as { chrome: unknown }).chrome = {
    runtime: {
      id: "test",
      getURL: (path: string) => path,
      sendMessage: (m: unknown) => {
        messages.push(m);
        return Promise.resolve();
      },
    },
    storage: { local: { get: async () => ({ ...store }), set }, onChanged: { addListener: (f: Listener) => listeners.push(f) } },
  };
  globalThis.requestAnimationFrame = () => 0;
  return { messages, set };
}

/** Indexes (in status order) of the pets shown right now. */
export const shownPets = () =>
  [...(document.getElementById("capstone-pet-host")?.shadowRoot?.querySelectorAll<HTMLElement>(".pet") ?? [])]
    .map((el, i) => (el.style.display !== "none" ? i : -1))
    .filter((i) => i >= 0);

export const tick = () => new Promise((r) => setTimeout(r, 0));
