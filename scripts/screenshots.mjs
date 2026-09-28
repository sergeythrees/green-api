/**
 * Screenshot harness for the README images.
 *
 * Drives the running dev server in headless Chromium over the Chrome DevTools
 * Protocol and captures the three screen states. It needs no extra npm
 * dependencies: it uses Node's built-in `fetch` and `WebSocket`.
 *
 * Usage:
 *   npm run dev            # in one terminal (http://localhost:5173)
 *   npm run screenshots    # in another
 *
 * Set CHROME_PATH to point at a specific Chromium/Chrome binary.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const APP_URL = process.env.APP_URL ?? 'http://127.0.0.1:5173/';
const OUT = 'docs/screenshots';
const PROFILE = '.cache/chrome-profile';
const HOME = '.cache/home';
const WIDTH = 1440;
const HEIGHT = 900;
const PORT = Number(process.env.CDP_PORT ?? 9333);
const PHONE = '79991234567';

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

const chromePath = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));
if (!chromePath) {
  throw new Error(
    `No Chromium/Chrome binary found. Set CHROME_PATH. Tried:\n${CHROME_CANDIDATES.join('\n')}`,
  );
}

mkdirSync(OUT, { recursive: true });
mkdirSync(PROFILE, { recursive: true });
mkdirSync(HOME, { recursive: true });

// Chromium writes its profile and caches under $HOME, which may be outside a
// sandboxed working directory, so HOME and the profile dir are relocated into
// the git-ignored `.cache` directory.
const chrome = spawn(
  chromePath,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${process.cwd()}/${PROFILE}`,
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-crash-reporter',
    '--hide-scrollbars',
    'about:blank',
  ],
  { stdio: 'ignore', env: { ...process.env, HOME: `${process.cwd()}/${HOME}` } },
);

/** Fake GREEN-API backend injected into the page before any app code runs. */
const STUB = `
// Keep runs independent of the persisted Chromium profile: start logged out.
// The SEED script below runs after this one and restores the session when needed.
try { localStorage.removeItem('green-api-max-chat:credentials'); } catch (e) {}
window.__queue = [];
window.__waiters = [];
window.__sent = [];
window.__pushNotification = function (n) {
  var w = window.__waiters.shift();
  if (w) w(n); else window.__queue.push(n);
};
window.fetch = function (input, init) {
  var url = String(input);
  var json = function (body, status) {
    return Promise.resolve(new Response(JSON.stringify(body), {
      status: status || 200,
      headers: { 'Content-Type': 'application/json' },
    }));
  };
  if (url.indexOf('/getStateInstance/') !== -1) return json({ stateInstance: 'authorized' });
  if (url.indexOf('/setSettings/') !== -1) return json({ saveSettings: true });
  if (url.indexOf('/checkAccount/') !== -1) return json({ exist: true, chatId: '10000000', fromCache: true });
  if (url.indexOf('/sendMessage/') !== -1) {
    var body = JSON.parse(init.body);
    window.__sent.push(body);
    return json({ idMessage: 'srv-' + window.__sent.length });
  }
  if (url.indexOf('/deleteNotification/') !== -1) return json({ result: true, reason: '' });
  if (url.indexOf('/receiveNotification/') !== -1) {
    if (window.__queue.length) return json(window.__queue.shift());
    // Park the long poll until a notification is pushed, exactly like the real API.
    return new Promise(function (resolve) {
      window.__waiters.push(function (n) { resolve(new Response(JSON.stringify(n), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      })); });
    });
  }
  return json({ reason: 'unexpected ' + url }, 404);
};
`;

const SEED = `
localStorage.setItem('green-api-max-chat:credentials', JSON.stringify({
  apiUrl: 'https://api.green-api.com',
  idInstance: '3100000001',
  apiTokenInstance: 'demo-token',
}));
`;

async function waitForDevTools() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (response.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(200);
  }
  throw new Error('Chrome DevTools endpoint never became reachable');
}

await waitForDevTools();

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('No page target found');

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let messageId = 0;
const pending = new Map();
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  const resolve = pending.get(message.id);
  if (resolve) {
    pending.delete(message.id);
    resolve(message);
  }
});

function send(method, params = {}) {
  const id = (messageId += 1);
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    pending.set(id, (message) => {
      if (message.error) reject(new Error(`${method}: ${JSON.stringify(message.error)}`));
      else resolve(message.result);
    });
  });
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(`evaluate failed: ${JSON.stringify(result.exceptionDetails.exception)}`);
  }
  return result.result.value;
}

async function shoot(name) {
  const result = await send('Page.captureScreenshot', { format: 'png' });
  const file = `${OUT}/${name}.png`;
  writeFileSync(file, Buffer.from(result.data, 'base64'));
  console.log(`saved ${file}`);
}

/** Navigates to the app and waits until something is mounted. */
async function boot() {
  await send('Page.navigate', { url: APP_URL });
  await sleep(1800);
  const ready = await evaluate(
    "!!document.querySelector('.sidebar') || !!document.querySelector('.login__title')",
  );
  if (!ready) throw new Error('app did not render');
}

/** Sets a React-controlled field through the native value setter. */
function setField(selector, value) {
  return `
    (function () {
      var el = document.querySelector(${JSON.stringify(selector)});
      if (!el) throw new Error('field not found: ' + ${JSON.stringify(selector)});
      var proto = el.tagName === 'TEXTAREA'
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
      var setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      setter.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
    })()
  `;
}

function clickByText(text) {
  return `
    (function () {
      var el = Array.prototype.find.call(document.querySelectorAll('button'), function (b) {
        return b.textContent.trim() === ${JSON.stringify(text)};
      });
      if (!el) throw new Error('button not found: ' + ${JSON.stringify(text)});
      el.click();
    })()
  `;
}

/** Opens the "new chat" dialog and submits a phone number. */
async function createChat() {
  await evaluate(clickByText('Новый чат'));
  await sleep(300);
  await evaluate(setField('[role="dialog"] input', PHONE));
  await sleep(200);
  await evaluate(clickByText('Создать чат'));
  await sleep(700);
  if (!(await evaluate("!!document.querySelector('.composer__input')"))) {
    throw new Error('chat did not open: composer is missing');
  }
}

try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: WIDTH,
    height: HEIGHT,
    deviceScaleFactor: 2,
    mobile: false,
  });

  // --- 1. Credentials screen ------------------------------------------------
  await send('Page.addScriptToEvaluateOnNewDocument', { source: STUB });
  await boot();
  if ((await evaluate("document.querySelector('.login__title')?.textContent ?? null")) !== 'MAX') {
    throw new Error('login screen did not render');
  }
  await shoot('01-login');

  // --- 2. New chat dialog ---------------------------------------------------
  await send('Page.addScriptToEvaluateOnNewDocument', { source: SEED });
  await boot();
  await evaluate(clickByText('Новый чат'));
  await sleep(300);
  await evaluate(setField('[role="dialog"] input', PHONE));
  await sleep(300);
  if (!(await evaluate("!!document.querySelector('[role=\"dialog\"]')"))) {
    throw new Error('new chat dialog did not open');
  }
  await shoot('02-new-chat');

  // --- 3. Conversation ------------------------------------------------------
  await boot();
  await createChat();

  const outgoingText = 'Привет! Это сообщение отправлено через GREEN-API SendMessage';
  await evaluate(setField('.composer__input', outgoingText));
  await sleep(200);
  await evaluate("document.querySelector('.composer__send').click()");
  await sleep(500);
  if (!(await evaluate("document.body.innerText.includes('SendMessage')"))) {
    throw new Error('outgoing bubble did not render');
  }

  // The recipient answers in MAX; the polling loop picks the reply up.
  await evaluate(`
    window.__pushNotification({
      receiptId: 555,
      body: {
        typeWebhook: 'incomingMessageReceived',
        instanceData: { idInstance: 3100000001, wid: '${PHONE}@c.us', typeInstance: 'v3' },
        timestamp: Math.floor(Date.now() / 1000),
        idMessage: 'incoming-1',
        senderData: {
          chatId: '10000000',
          chatName: 'Анна Смирнова',
          sender: '10000000',
          senderName: 'Анна Смирнова',
          senderContactName: 'Анна Смирнова',
          senderPhoneNumber: ${PHONE}
        },
        messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'Привет! Да, всё получилось, сообщение дошло' } }
      }
    })
  `);
  await sleep(1000);

  if (!(await evaluate("document.body.innerText.includes('сообщение дошло')"))) {
    throw new Error('incoming bubble did not render');
  }

  const sentCount = await evaluate('window.__sent.length');
  if (sentCount !== 1) throw new Error(`expected exactly 1 SendMessage call, got ${sentCount}`);
  const target = await evaluate('JSON.stringify(window.__sent[0])');
  console.log(`SendMessage payload: ${target}`);

  await shoot('03-conversation');

  // --- 4. Dark theme --------------------------------------------------------
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: 'dark' }],
  });
  await sleep(400);
  await shoot('04-conversation-dark');

  console.log('done');
} finally {
  socket.close();
  chrome.kill('SIGKILL');
}
