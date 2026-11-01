// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import '../../extension/content/logic.js';
import { EVENTS, installBridge } from '../src/preload/studium.js';

const L = globalThis.PetLogic;

describe('EVENTS', () => {
  it('match the names in extension/content/logic.js', () => {
    expect(EVENTS).toEqual({
      PET_STATUS_KEY: L.PET_STATUS_KEY,
      PET_STATUS_EVENT: L.PET_STATUS_EVENT,
      SETTINGS_KEY: L.SETTINGS_KEY,
      SETTINGS_EVENT: L.SETTINGS_EVENT,
      FOCUS_SESSIONS_EVENT: L.FOCUS_SESSIONS_EVENT,
      FOCUS_RECEIVED_EVENT: L.FOCUS_RECEIVED_EVENT,
      READY_EVENT: L.READY_EVENT,
      WAKE_PET_EVENT: L.WAKE_PET_EVENT,
      TASK_DONE_EVENT: L.TASK_DONE_EVENT,
    });
  });
});

describe('installBridge', () => {
  let sent;
  let handlers;
  let controller;
  const ipc = {
    send: (channel, payload) => sent.push([channel, payload]),
    on: (channel, fn) => {
      handlers[channel] = fn;
    },
  };
  const install = () => {
    controller?.abort();
    controller = new AbortController();
    installBridge({ win: window, storage: localStorage, ipc, signal: controller.signal });
  };
  const fire = (name, detail) => window.dispatchEvent(detail === undefined ? new Event(name) : new CustomEvent(name, { detail }));

  beforeEach(() => {
    localStorage.clear();
    sent = [];
    handlers = {};
  });

  it("sends Studium's pet statuses and settings when installed", () => {
    localStorage.setItem('studium-pets-v1', '{"x":1}');
    install();
    expect(sent).toContainEqual(['studium:statuses', '{"x":1}']);
    expect(sent).toContainEqual(['studium:settings', null]);
  });

  it('sends them again when Studium says they changed', () => {
    install();
    sent = [];
    localStorage.setItem('studium-settings-v1', '{"petInvolvement":"moderate"}');
    fire('studium:settings-updated');
    localStorage.setItem('studium-pets-v1', '{"pets":[]}');
    fire('studium:pets-updated');
    expect(sent).toEqual([
      ['studium:settings', '{"petInvolvement":"moderate"}'],
      ['studium:statuses', '{"pets":[]}'],
    ]);
  });

  it('forwards ready', () => {
    install();
    sent = [];
    fire('studium:ready');
    expect(sent).toEqual([['studium:ready', undefined]]);
  });

  it('forwards saved session ids, and nothing that is not a list of ids', () => {
    install();
    sent = [];
    fire('studium:focus-received', '["a"]');
    for (const bad of ['nope', '[]', '[1]', undefined]) fire('studium:focus-received', bad);
    expect(sent).toEqual([['studium:delivered', ['a']]]);
  });

  it("forwards the habitat's Wake button", () => {
    install();
    sent = [];
    fire('studium:wake-pet', 'webDev');
    fire('studium:wake-pet', '');
    expect(sent).toEqual([['studium:wake', 'webDev']]);
  });

  it('forwards a checked-off task (a pet napping on it wakes up)', () => {
    install();
    sent = [];
    fire('studium:task-done', 't1');
    fire('studium:task-done', '');
    expect(sent).toEqual([['studium:task-done', 't1']]);
  });

  it('hands finished naps to Studium as JSON text', () => {
    install();
    const got = [];
    window.addEventListener('studium:focus-sessions', (e) => got.push(e.detail));
    handlers['studium:focus-sessions']({}, [{ id: 's1' }]);
    handlers['studium:focus-sessions']({}, []);
    expect(got).toEqual(['[{"id":"s1"}]']);
  });
});
