import http from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { startBrowserSignIn } from '../src/main/browserSignIn.js';

const HOSTED = 'https://studium.example/';
const call = (url) => fetch(url);

/** An openExternal that reads the port and state out of the page URL and then calls the local server back. */
function opener(callback) {
  return vi.fn(async (url) => {
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe(`${HOSTED}desktop-sign-in.html`);
    const { port, state, provider } = Object.fromEntries(u.searchParams);
    expect(provider).toBe('google');
    expect(state).toMatch(/^[0-9a-f]{64}$/);
    await callback({ port, state });
  });
}

afterEach(() => vi.useRealTimers());

describe('startBrowserSignIn', () => {
  it('resolves with the tokens when the callback has the right state', async () => {
    let reply;
    const openExternal = opener(async ({ port, state }) => {
      reply = call(`http://127.0.0.1:${port}/callback?state=${state}&idToken=ID&accessToken=ACCESS`);
    });
    const tokens = await startBrowserSignIn({ provider: 'google', hostedUrl: HOSTED, openExternal });
    expect(tokens).toEqual({ idToken: 'ID', accessToken: 'ACCESS' });
    const page = await reply;
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('You can close this tab');
  });

  it('ignores a callback with the wrong state', async () => {
    let wrong;
    const openExternal = opener(async ({ port, state }) => {
      wrong = await call(`http://127.0.0.1:${port}/callback?state=${'0'.repeat(64)}&idToken=BAD`);
      await call(`http://127.0.0.1:${port}/callback?state=${state}&idToken=GOOD`);
    });
    const tokens = await startBrowserSignIn({ provider: 'google', hostedUrl: HOSTED, openExternal });
    expect(wrong.status).toBe(400);
    expect(tokens).toEqual({ idToken: 'GOOD' });
  });

  it('rejects with cancelled when the page reports an error', async () => {
    const openExternal = opener(async ({ port, state }) => {
      await call(`http://127.0.0.1:${port}/callback?state=${state}&error=cancelled`);
    });
    await expect(startBrowserSignIn({ provider: 'google', hostedUrl: HOSTED, openExternal })).rejects.toThrow('cancelled');
  });

  it('rejects with cancelled after the timeout and stops listening', async () => {
    let port;
    const openExternal = opener(async (p) => {
      port = p.port;
    });
    const result = startBrowserSignIn({ provider: 'google', hostedUrl: HOSTED, openExternal, timeoutMs: 50 });
    await expect(result).rejects.toThrow('cancelled');
    await expect(call(`http://127.0.0.1:${port}/callback?state=x`)).rejects.toThrow();
  });

  it('closes the server after one successful callback', async () => {
    let port;
    const openExternal = opener(async (p) => {
      port = p.port;
      await call(`http://127.0.0.1:${p.port}/callback?state=${p.state}&idToken=ID`);
    });
    await startBrowserSignIn({ provider: 'google', hostedUrl: HOSTED, openExternal });
    await expect(call(`http://127.0.0.1:${port}/callback?state=x&idToken=again`)).rejects.toThrow();
  });

  it('answers other paths with 404 and keeps waiting', async () => {
    let other;
    const openExternal = opener(async ({ port, state }) => {
      other = await call(`http://127.0.0.1:${port}/favicon.ico`);
      await call(`http://127.0.0.1:${port}/callback?state=${state}&idToken=ID`);
    });
    await startBrowserSignIn({ provider: 'google', hostedUrl: HOSTED, openExternal });
    expect(other.status).toBe(404);
  });

  it('rejects and stops listening if the browser cannot be opened', async () => {
    const openExternal = vi.fn(async () => {
      throw new Error('no browser');
    });
    await expect(startBrowserSignIn({ provider: 'google', hostedUrl: HOSTED, openExternal })).rejects.toThrow('no browser');
  });

  it('can be cancelled from outside', async () => {
    const openExternal = vi.fn(async () => {});
    const ctl = new AbortController();
    const result = startBrowserSignIn({ provider: 'google', hostedUrl: HOSTED, openExternal, signal: ctl.signal });
    await vi.waitFor(() => expect(openExternal).toHaveBeenCalled());
    ctl.abort();
    await expect(result).rejects.toThrow('cancelled');
  });

  it('a matching state with no idToken is a 400 and keeps waiting', async () => {
    let bad;
    const openExternal = opener(async ({ port, state }) => {
      bad = await call(`http://127.0.0.1:${port}/callback?state=${state}`);
      await call(`http://127.0.0.1:${port}/callback?state=${state}&idToken=ID`);
    });
    const tokens = await startBrowserSignIn({ provider: 'google', hostedUrl: HOSTED, openExternal });
    expect(bad.status).toBe(400);
    expect(tokens).toEqual({ idToken: 'ID' });
  });

  it('stops listening when cancelled before the server was ready', async () => {
    const spy = vi.spyOn(http.Server.prototype, 'close');
    const ctl = new AbortController();
    const openExternal = vi.fn();
    const result = startBrowserSignIn({ provider: 'google', hostedUrl: HOSTED, openExternal, signal: ctl.signal });
    ctl.abort(); // before the listen callback runs
    await expect(result).rejects.toThrow('cancelled');
    await new Promise((r) => setTimeout(r, 50));
    const server = spy.mock.contexts[spy.mock.contexts.length - 1];
    spy.mockRestore();
    expect(openExternal).not.toHaveBeenCalled();
    expect(server.listening).toBe(false);
  });
});
