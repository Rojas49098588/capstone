// Sign-in through the system browser. Studium opens the hosted sign-in page in the person's browser;
// the page signs in with Google and sends the tokens back to a one-shot server on this computer.
// No Electron in here: the caller passes in how to open a URL.
const crypto = require('node:crypto');
const http = require('node:http');

const DONE_PAGE = "You're signed in to Studium. You can close this tab.";
const CANCELLED_PAGE = 'Sign-in was cancelled. You can close this tab and try again in Studium.';

const page = (text) => `<!doctype html><meta charset="utf-8"><title>Studium</title><body style="font-family:sans-serif;margin:3rem"><p>${text}</p></body>`;

function sameState(given, expected) {
  const a = Buffer.from(String(given ?? ''));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Opens `${hostedUrl}desktop-sign-in.html?provider=…&port=…&state=…` and waits for the page to call back on
 * http://127.0.0.1:<port>/callback with the same state. Resolves with { idToken, accessToken?, rawNonce? }.
 * Rejects with "cancelled" on an error callback, on timeout, or when `signal` aborts. The server is
 * closed in every case, and after exactly one accepted callback.
 */
function startBrowserSignIn({ provider, hostedUrl, openExternal, timeoutMs = 300000, signal }) {
  const state = crypto.randomBytes(32).toString('hex');
  return new Promise((resolve, reject) => {
    let timer = null;
    let settled = false;
    const server = http.createServer();

    const finish = (fail, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      server.close();
      server.closeIdleConnections();
      if (fail) reject(fail);
      else resolve(value);
    };
    const onAbort = () => finish(new Error('cancelled'));

    server.on('request', (req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      const reply = (status, text) => {
        res.writeHead(status, { 'content-type': 'text/html; charset=utf-8', connection: 'close', 'cache-control': 'no-store' });
        res.end(page(text));
      };
      if (req.method !== 'GET' || url.pathname !== '/callback') return reply(404, 'Not found.');
      if (!sameState(url.searchParams.get('state'), state)) return reply(400, 'This sign-in link is not valid.');
      if (url.searchParams.get('error')) {
        reply(200, CANCELLED_PAGE);
        return finish(new Error('cancelled'));
      }
      const idToken = url.searchParams.get('idToken');
      if (!idToken) return reply(400, 'This sign-in link is not valid.');
      const tokens = { idToken };
      for (const key of ['accessToken', 'rawNonce']) {
        const v = url.searchParams.get(key);
        if (v) tokens[key] = v;
      }
      reply(200, DONE_PAGE);
      finish(null, tokens);
    });
    server.on('error', (e) => finish(e));

    if (signal?.aborted) return finish(new Error('cancelled'));
    signal?.addEventListener('abort', onAbort);
    server.listen(0, '127.0.0.1', async () => {
      if (settled) return server.close(); // cancelled before it was listening
      timer = setTimeout(() => finish(new Error('cancelled')), timeoutMs);
      const { port } = server.address();
      const query = new URLSearchParams({ provider, port: String(port), state });
      try {
        await openExternal(`${hostedUrl}desktop-sign-in.html?${query}`);
      } catch (e) {
        finish(e);
      }
    });
  });
}

module.exports = { startBrowserSignIn };
