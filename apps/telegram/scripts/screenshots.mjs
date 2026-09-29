/**
 * Screenshot harness for the README images.
 *
 * Drives the running dev server in headless Chromium over the Chrome DevTools
 * Protocol and captures the four screen states. It needs no extra npm
 * dependencies: it uses Node's built-in `fetch` and `WebSocket`.
 *
 * Usage:
 *   npm run dev            # in one terminal (http://localhost:5174)
 *   npm run screenshots    # in another
 *
 * Set CHROME_PATH to point at a specific Chromium/Chrome binary, and APP_URL if
 * the dev server runs somewhere else.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

// `localhost` rather than `127.0.0.1`: Vite binds the address the system prefers
// for `localhost`, which is `::1` on IPv6-preferring hosts, and a fixed IPv4
// address would then refuse the connection.
const APP_URL = process.env.APP_URL ?? 'http://localhost:5174/';
const OUT = 'docs/screenshots';
const PROFILE = '.cache/chrome-profile';
const HOME = '.cache/home';
const WIDTH = 1440;
const HEIGHT = 900;
const PORT = Number(process.env.CDP_PORT ?? 9333);
const PHONE = '79991234567';
const PEER_CHAT_ID = '6900000001';
const SELF_CHAT_ID = '305000000';
const SELF_ID = '305000000';
const ACCOUNT = '79001234567';

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

/**
 * Fake GREEN-API backend injected into the page before any app code runs.
 *
 * The outgoing notification bodies are the real ones captured on a live
 * instance with the identifiers replaced: in an outgoing notification
 * `senderData` describes the *account*, not the peer, and that is exactly what
 * this stub reproduces.
 */
const STUB = `
// Keep runs independent of the persisted Chromium profile: start logged out.
// The SEED script below runs after this one and restores the session when needed.
try { localStorage.removeItem('green-api-telegram-chat:credentials'); } catch (e) {}
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
  if (url.indexOf('/getAccountSettings/') !== -1) {
    return json({ stateInstance: 'authorized', username: '@green_api_demo', phone: ${ACCOUNT} });
  }
  if (url.indexOf('/setSettings/') !== -1) return json({ saveSettings: true });
  if (url.indexOf('/checkAccount/') !== -1) return json({ exist: true, chatId: '10000000', fromCache: true });
  if (url.indexOf('/getContactInfo/') !== -1) {
    // The live answer for a peer whose profile name is unset: name is "." and
    // only the username and the phone identify them.
    return json({ chatId: '${PEER_CHAT_ID}', name: '.', username: '@peer_demo', phoneNumber: 79005556677 });
  }
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
localStorage.setItem('green-api-telegram-chat:credentials', JSON.stringify({
  apiUrl: 'https://4100.api.green-api.com',
  idInstance: '4100000001',
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

/** Everything the page logged as an error, for the failure path of `boot()`. */
const pageErrors = [];

let messageId = 0;
const pending = new Map();
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.method === 'Runtime.exceptionThrown') {
    pageErrors.push(message.params.exceptionDetails.exception?.description ?? 'exception');
  }
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
    pageErrors.push(
      message.params.args.map((a) => a.value ?? a.description ?? '').join(' '),
    );
  }
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

/** Polls an expression until it is truthy, or gives up after `timeout` ms. */
async function waitFor(expression, timeout = 15000) {
  const deadline = Date.now() + timeout;
  for (;;) {
    if (await evaluate(expression)) return true;
    if (Date.now() > deadline) return false;
    await sleep(250);
  }
}

/**
 * Navigates to the app and waits until something is mounted.
 *
 * Polling rather than a flat sleep: the bundle carries a 227 KB pattern SVG and
 * a 55 KB icon font, and a cold Vite transform can outlast any fixed delay.
 */
async function boot() {
  await send('Page.navigate', { url: APP_URL });
  const ready = await waitFor(
    "!!document.querySelector('.sidebar') || !!document.querySelector('.login__title')",
  );
  if (!ready) {
    // A bare "did not render" is unactionable: dump what is actually on the page
    // and what the console said, so the next failure names its own cause.
    const text = await evaluate('document.body ? document.body.innerText : ""');
    throw new Error(
      `app did not render at ${APP_URL}\n  url: ${await evaluate('location.href')}\n` +
        `  body: ${JSON.stringify(String(text).slice(0, 300))}\n` +
        `  errors: ${JSON.stringify(pageErrors)}`,
    );
  }
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
  await sleep(400);
  await evaluate(setField('[role="dialog"] input', PHONE));
  await sleep(200);
  await evaluate(clickByText('Создать чат'));
  await waitFor("!!document.querySelector('.composer__field')");
  if (!(await evaluate("!!document.querySelector('.composer__field')"))) {
    throw new Error('chat did not open: composer is missing');
  }
}

/** The two real outgoing notification bodies, identifiers replaced. */
const OUTGOING_NOTIFICATIONS = `
  (function () {
    var now = Math.floor(Date.now() / 1000);
    window.__pushNotification({
      receiptId: 556,
      body: {
        typeWebhook: 'outgoingAPIMessageReceived',
        instanceData: { idInstance: 4100000001, wid: '${ACCOUNT}@c.us', typeInstance: 'telegram' },
        timestamp: now,
        idMessage: 'live-out-1',
        senderData: {
          chatId: '${PEER_CHAT_ID}', chatType: 'user', sender: '${SELF_ID}',
          chatName: '.', senderName: 'Владелец', senderContactName: 'Владелец',
          senderPhoneNumber: ${ACCOUNT}
        },
        messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'Отправлено с телефона' } }
      }
    });
    window.__pushNotification({
      receiptId: 557,
      body: {
        typeWebhook: 'outgoingAPIMessageReceived',
        instanceData: { idInstance: 4100000001, wid: '${ACCOUNT}@c.us', typeInstance: 'telegram' },
        timestamp: now,
        idMessage: 'live-out-2',
        senderData: {
          chatId: '${SELF_CHAT_ID}', chatType: 'user', sender: '${SELF_ID}',
          chatName: 'Владелец', senderName: 'Владелец', senderContactName: 'Владелец',
          senderPhoneNumber: ${ACCOUNT}
        },
        messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'Заметка самому себе' } }
      }
    });
  })()
`;

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
  if ((await evaluate("document.querySelector('.login__title')?.textContent ?? null")) !== 'Telegram') {
    throw new Error('login screen did not render');
  }
  await shoot('01-login');

  // --- 2. New chat dialog ---------------------------------------------------
  await send('Page.addScriptToEvaluateOnNewDocument', { source: SEED });
  await boot();
  await evaluate(clickByText('Новый чат'));
  await sleep(400);
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
  await evaluate(setField('input.composer__field, .composer__field input', outgoingText));
  await sleep(200);
  await evaluate("document.querySelector('.composer__send').click()");
  await sleep(500);
  if (!(await evaluate("document.body.innerText.includes('SendMessage')"))) {
    throw new Error('outgoing bubble did not render');
  }

  // The recipient answers in Telegram; the polling loop picks the reply up.
  await evaluate(`
    window.__pushNotification({
      receiptId: 555,
      body: {
        typeWebhook: 'incomingMessageReceived',
        instanceData: { idInstance: 4100000001, wid: '${PHONE}@c.us', typeInstance: 'telegram' },
        timestamp: Math.floor(Date.now() / 1000),
        idMessage: 'incoming-1',
        senderData: {
          chatId: '10000000',
          chatType: 'user',
          sender: '10000000',
          chatName: 'Анна Смирнова',
          senderName: 'Анна Смирнова',
          senderContactName: 'Анна Смирнова',
          senderPhoneNumber: ${PHONE}
        },
        messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'Привет! Да, всё получилось, сообщение дошло' } }
      }
    })
  `);
  await sleep(1000);

  await evaluate(OUTGOING_NOTIFICATIONS);

  // A message whose text is one long unbreakable run: the case that used to push
  // the preview past the left edge of the row and drag the avatar with it.
  await evaluate(`
    (function () {
      var long = new Array(60).join('двладмыывапдыелвапх');
      window.__pushNotification({
        receiptId: 558,
        body: {
          typeWebhook: 'incomingMessageReceived',
          instanceData: { idInstance: 4100000001, wid: '${PHONE}@c.us', typeInstance: 'telegram' },
          timestamp: Math.floor(Date.now() / 1000),
          idMessage: 'incoming-long',
          senderData: {
            chatId: '10000002', chatType: 'user', sender: '10000002',
            chatName: 'Realtime Jobs', senderName: 'Realtime Jobs',
            senderContactName: 'Realtime Jobs', senderPhoneNumber: 79001112233
          },
          messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: long } }
        }
      });
    })()
  `);
  await sleep(1500);

  // Layout guard: a long preview must stay on one line inside the content column
  // and must not reach the avatar. jsdom has no layout, so this belongs here.
  const geometry = await evaluate(`
    (function () {
      var rows = Array.prototype.slice.call(document.querySelectorAll('.chat-row'));
      var worst = null;
      rows.forEach(function (row) {
        var preview = row.querySelector('.chat-row__preview');
        var avatar = row.querySelector('.chat-row__avatar');
        if (!preview) return;
        var p = preview.getBoundingClientRect();
        var r = row.getBoundingClientRect();
        var a = avatar ? avatar.getBoundingClientRect() : null;
        var lines = Math.round(p.height / 20);
        var record = {
          lines: lines,
          overflowsLeft: Math.round(p.left - r.left),
          hitsAvatar: a ? p.left < a.right : false
        };
        if (!worst || record.lines > worst.lines) worst = record;
      });
      return JSON.stringify(worst);
    })()
  `);
  const worst = JSON.parse(geometry);
  console.log('longest preview row:', geometry);
  if (worst.lines > 1) throw new Error(`preview wrapped to ${worst.lines} lines instead of one`);
  if (worst.overflowsLeft < 8) throw new Error(`preview reaches the row edge (${worst.overflowsLeft}px)`);
  if (worst.hitsAvatar) throw new Error('preview overlaps the avatar');

  // The outgoing bodies must resolve the peer instead of naming the account.
  if (!(await evaluate("document.body.innerText.includes('@peer_demo')"))) {
    throw new Error('getContactInfo did not name the peer');
  }
  if (await evaluate("document.body.innerText.includes('Владелец')")) {
    throw new Error('the operator leaked into the chat list');
  }
  if (!(await evaluate("document.body.innerText.includes('сообщение дошло')"))) {
    throw new Error('incoming bubble did not render');
  }

  const sentCount = await evaluate('window.__sent.length');
  if (sentCount !== 1) throw new Error(`expected exactly 1 SendMessage call, got ${sentCount}`);
  const target = await evaluate('JSON.stringify(window.__sent[0])');
  console.log(`SendMessage payload: ${target}`);

  // Type without sending: the send control only appears filled once there is
  // something to send, so a shot of an empty field would miss the real state.
  await evaluate(setField('input.composer__field, .composer__field input', 'Проверка поля ввода'));
  await sleep(400);
  const sendEnabled = await evaluate("!document.querySelector('.composer__send').disabled");
  if (!sendEnabled) throw new Error('the send button stayed disabled with a text in the field');
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
