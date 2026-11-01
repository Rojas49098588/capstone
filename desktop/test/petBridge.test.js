import { describe, expect, it } from 'vitest';
import { installPetBridge } from '../src/preload/petBridge.js';

function fakeIpc() {
  const sent = [];
  const invoked = [];
  const handlers = {};
  return {
    sent,
    invoked,
    fire: (channel, payload) => handlers[channel]?.forEach((fn) => fn({}, payload)),
    send: (channel, payload) => sent.push([channel, payload]),
    invoke: (channel, payload) => {
      invoked.push([channel, payload]);
      return Promise.resolve({ answer: payload });
    },
    on: (channel, fn) => {
      (handlers[channel] ??= []).push(fn);
    },
  };
}

function install() {
  const ipc = fakeIpc();
  let exposed = null;
  installPetBridge({ ipc, expose: (name, api) => (exposed = { name, api }) });
  return { ipc, exposed };
}

describe('installPetBridge', () => {
  it('exposes petBridge', () => {
    expect(install().exposed.name).toBe('petBridge');
  });

  it('get asks the main process and returns its answer', async () => {
    const { ipc, exposed } = install();
    await expect(exposed.api.get(['pets'])).resolves.toEqual({ answer: ['pets'] });
    expect(ipc.invoked).toEqual([['pets:get', ['pets']]]);
  });

  it('set, send and setMouse go on their own channels', () => {
    const { ipc, exposed } = install();
    exposed.api.set({ pets: {} });
    exposed.api.send({ type: 'nap', projectId: 'a' });
    exposed.api.setMouse(true);
    exposed.api.setMouse('yes');
    expect(ipc.sent).toEqual([
      ['pets:set', { pets: {} }],
      ['pets:message', { type: 'nap', projectId: 'a' }],
      ['overlay:mouse', true],
      ['overlay:mouse', false],
    ]);
  });

  it('onChanged listeners get the changes the main process sends', () => {
    const { ipc, exposed } = install();
    const got = [];
    exposed.api.onChanged((c) => got.push(c));
    ipc.fire('pets:changed', { petHidden: { newValue: true } });
    expect(got).toEqual([{ petHidden: { newValue: true } }]);
  });
});
