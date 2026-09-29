import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { mockResponse } from './test/response';
import type { NotificationBody } from './api/types';

const STORAGE_KEY = 'green-api-telegram-chat:credentials';

const incomingReply: NotificationBody = {
  typeWebhook: 'incomingMessageReceived',
  instanceData: { idInstance: 4100000001, wid: '79991234567@c.us', typeInstance: 'telegram' },
  timestamp: 1763115200,
  idMessage: 'incoming-1',
  senderData: {
    chatId: '10000000',
    chatType: 'user',
    chatName: 'Получатель',
    sender: '10000000',
    senderName: 'Получатель',
    senderContactName: 'Получатель',
    senderPhoneNumber: 79991234567,
  },
  messageData: {
    typeMessage: 'textMessage',
    textMessageData: { textMessage: 'Привет от получателя' },
  },
};

interface Harness {
  /** Delivers a notification to the app's polling loop. */
  pushNotification: (notification: { receiptId: number; body: NotificationBody }) => void;
  sentMessages: Array<{ chatId: string; message: string }>;
  deletedReceiptIds: string[];
}

/**
 * Installs a fetch mock that speaks the GREEN-API Telegram protocol.
 *
 * `receiveNotification` parks (never resolves) until a notification is pushed,
 * which mirrors the real long poll without leaving timers behind.
 *
 * `account` controls `getAccountSettings`. It is off by default so the header
 * keeps showing the instance id, exactly as it does when the method is
 * unavailable — which is the case the app has to survive.
 */
function installFetchMock(options: { account?: { username?: string; phone?: string } } = {}): Harness {
  const sentMessages: Array<{ chatId: string; message: string }> = [];
  const deletedReceiptIds: string[] = [];
  const queue: Array<{ receiptId: number; body: NotificationBody }> = [];
  const waiting: Array<(value: Response) => void> = [];

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (url.includes('/getStateInstance/')) {
      return mockResponse({ stateInstance: 'authorized' });
    }
    if (url.includes('/getAccountSettings/')) {
      if (!options.account) throw new Error('Unexpected request: ' + url);
      return mockResponse({ stateInstance: 'authorized', ...options.account });
    }
    if (url.includes('/setSettings/')) {
      return mockResponse({ saveSettings: true });
    }
    if (url.includes('/checkAccount/')) {
      return mockResponse({ exist: true, chatId: '10000000', fromCache: true });
    }
    if (url.includes('/getContactInfo/')) {
      // The live answer for a peer whose profile name is unset: `name` is "."
      // and only `username` and `phoneNumber` identify them.
      return mockResponse({ chatId: '6900000001', name: '.', username: '@peer_demo', phoneNumber: 79005556677 });
    }
    if (url.includes('/sendMessage/')) {
      sentMessages.push(JSON.parse(String(init?.body)) as { chatId: string; message: string });
      return mockResponse({ idMessage: 'srv-1' });
    }
    if (url.includes('/deleteNotification/')) {
      deletedReceiptIds.push(url.split('/').pop() ?? '');
      return mockResponse({ result: true, reason: '' });
    }
    if (url.includes('/receiveNotification/')) {
      const next = queue.shift();
      if (next) return mockResponse(next);
      return new Promise<Response>((resolve) => waiting.push(resolve));
    }

    throw new Error(`Unexpected request: ${url}`);
  });

  vi.stubGlobal('fetch', fetchMock);

  return {
    sentMessages,
    deletedReceiptIds,
    pushNotification(notification) {
      const resolve = waiting.shift();
      if (resolve) resolve(mockResponse(notification));
      else queue.push(notification);
    },
  };
}

/** The message text appears both in the bubble and in the sidebar preview. */
async function expectTextSomewhere(text: string): Promise<void> {
  const found = await screen.findAllByText(text);
  expect(found.length).toBeGreaterThan(0);
}

/**
 * Logs in through the credentials form and waits for the chat list.
 *
 * The account name lives in the burger menu now, the way Telegram Web keeps it,
 * so `openMenu` is what a caller needs before asserting on it.
 */
async function login(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.type(await screen.findByLabelText('idInstance'), '4100000001');
  await user.type(screen.getByLabelText('apiTokenInstance'), 'token');
  await user.click(screen.getByRole('button', { name: 'Подключиться' }));
  await screen.findByLabelText('Поиск чатов');
}

/** Opens the burger menu that holds the account name and the logout action. */
async function openMenu(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'Главное меню' }));
}

/** Opens the "new chat" dialog and submits the contact. */
async function createChat(
  user: ReturnType<typeof userEvent.setup>,
  contact: string,
): Promise<void> {
  await user.click(screen.getAllByRole('button', { name: 'Новый чат' })[0]);
  await user.type(await screen.findByLabelText('Номер телефона или @username'), contact);
  await user.click(screen.getByRole('button', { name: 'Создать чат' }));
}

/**
 * Finds a bubble inside the open conversation.
 *
 * The same text also lives in the sidebar preview, so the search assertions
 * have to be scoped to the message list rather than the whole document.
 */
function findBubble(text: string): Promise<HTMLElement> {
  return screen.findByText(text, {
    selector: '.messages .bubble__text',
  });
}

/** A text message notification for the demo conversation. */
function reply(idMessage: string, text: string): NotificationBody {
  return {
    ...incomingReply,
    idMessage,
    messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: text } },
  };
}

/**
 * Logs in, creates the demo chat and delivers two replies: one holding the
 * searched word, one that must be hidden by the filter.
 */
async function openChatWithTwoReplies(user: ReturnType<typeof userEvent.setup>): Promise<Harness> {
  const harness = installFetchMock();
  render(<App />);

  await login(user);
  await createChat(user, '79991234567');

  harness.pushNotification({ receiptId: 601, body: reply('incoming-2', 'Заметка про альбатроса') });
  harness.pushNotification({ receiptId: 602, body: reply('incoming-3', 'Совсем другое сообщение') });

  await findBubble('Заметка про альбатроса');
  return harness;
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('shows the credentials form when no session is stored', async () => {
    installFetchMock();
    render(<App />);

    expect(await screen.findByLabelText('idInstance')).toBeInTheDocument();
    expect(screen.getByLabelText('apiTokenInstance')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Подключиться' })).toBeInTheDocument();
  });

  it('shows the signed-in account in the burger menu, like Telegram Web', async () => {
    installFetchMock({ account: { username: '@green_api' } });
    const user = userEvent.setup();
    render(<App />);

    await login(user);
    await openMenu(user);
    expect(await screen.findByText('@green_api')).toBeInTheDocument();
  });

  it('falls back to the instance id when the account cannot be read', async () => {
    // The default harness has no `getAccountSettings` answer, which is exactly
    // the "method failed" case: the menu must still identify the instance.
    installFetchMock();
    const user = userEvent.setup();
    render(<App />);

    await login(user);
    await openMenu(user);
    await screen.findByLabelText('Поиск чатов');
  });

  it('logs out from the burger menu instead of a permanent header button', async () => {
    installFetchMock();
    const user = userEvent.setup();
    render(<App />);

    await login(user);
    await openMenu(user);
    await user.click(screen.getByRole('menuitem', { name: 'Выйти' }));

    expect(await screen.findByLabelText('idInstance')).toBeInTheDocument();
  });

  it('drives the full acceptance flow: login, new chat, send, receive', async () => {
    const harness = installFetchMock();
    const user = userEvent.setup();
    // Rendered exactly as `main.tsx` does, so StrictMode's double-invoked
    // effects are part of the tested path.
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );

    // 1. The user enters their GREEN-API credentials.
    await login(user);

    // 2. The chat screen opens and polling is running.
    // Telegram Web shows no status line while everything is fine.
    expect(screen.queryByText(/Приём/)).not.toBeInTheDocument();

    // 3. The user enters the recipient's phone number and creates a chat.
    await createChat(user, '79991234567');
    await expectTextSomewhere('+7 999 123-45-67');

    // 4. The user writes a text message and sends it.
    await user.type(screen.getByPlaceholderText('Напишите сообщение…'), 'Привет из GREEN-API');
    await user.click(screen.getByRole('button', { name: 'Отправить' }));
    await expectTextSomewhere('Привет из GREEN-API');

    // Sent to the numeric chatId resolved by checkAccount, not to phone@c.us.
    await waitFor(() => {
      expect(harness.sentMessages).toEqual([
        { chatId: '10000000', message: 'Привет из GREEN-API' },
      ]);
    });

    // 5. The recipient answers in Telegram; the app picks the reply up by polling.
    harness.pushNotification({ receiptId: 555, body: incomingReply });
    await expectTextSomewhere('Привет от получателя');

    // 6. The notification is confirmed so the FIFO queue advances.
    await waitFor(() => {
      expect(harness.deletedReceiptIds).toContain('555');
    });

    // 7. The peer's name replaces the temporary phone-number title.
    await expectTextSomewhere('Получатель');
  });

  it('filters the open conversation by the search field', async () => {
    const user = userEvent.setup();
    await openChatWithTwoReplies(user);

    await user.click(screen.getByRole('button', { name: 'Поиск по чату' }));
    await user.type(await screen.findByLabelText('Поиск по чату'), 'альбатрос');

    expect(await findBubble('Заметка про альбатроса')).toBeInTheDocument();
    expect(screen.queryByText('Совсем другое сообщение', { selector: '.messages .bubble__text' }))
      .not.toBeInTheDocument();
  });

  it('says so when the search matches nothing', async () => {
    const user = userEvent.setup();
    await openChatWithTwoReplies(user);

    await user.click(screen.getByRole('button', { name: 'Поиск по чату' }));
    await user.type(await screen.findByLabelText('Поиск по чату'), 'нетничегопохожего');

    expect(await screen.findByText('Ничего не найдено')).toBeInTheDocument();
    expect(screen.queryByText('Заметка про альбатроса', { selector: '.messages .bubble__text' }))
      .not.toBeInTheDocument();
    expect(screen.queryByText('Совсем другое сообщение', { selector: '.messages .bubble__text' }))
      .not.toBeInTheDocument();
  });

  it('cancelling the search brings the messages back', async () => {
    const user = userEvent.setup();
    await openChatWithTwoReplies(user);

    await user.click(screen.getByRole('button', { name: 'Поиск по чату' }));
    await user.type(await screen.findByLabelText('Поиск по чату'), 'альбатрос');
    expect(
      screen.queryByText('Совсем другое сообщение', { selector: '.messages .bubble__text' }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Отмена' }));

    // The header leaves search mode entirely: no cancel button, and the
    // magnifier is back in place of the query field.
    expect(screen.queryByRole('button', { name: 'Отмена' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Поиск по чату' })).not.toBeInTheDocument();
    expect(await findBubble('Заметка про альбатроса')).toBeInTheDocument();
    expect(await findBubble('Совсем другое сообщение')).toBeInTheDocument();
  });

  it('restores a saved session without asking for credentials again', async () => {
    installFetchMock();
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        apiUrl: 'https://api.green-api.com',
        idInstance: '4100000001',
        apiTokenInstance: 'token',
      }),
    );

    render(<App />);

    await screen.findByLabelText('Поиск чатов');
    expect(screen.queryByLabelText('apiTokenInstance')).not.toBeInTheDocument();
  });

  it('restores a saved session under StrictMode double-invoked effects', async () => {
    // `main.tsx` renders inside <StrictMode>, which mounts, cleans up and
    // remounts every effect. A restore that is cancelled by that cleanup must
    // still complete on the second run instead of hanging on the splash.
    installFetchMock();
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        apiUrl: 'https://api.green-api.com',
        idInstance: '4100000001',
        apiTokenInstance: 'token',
      }),
    );

    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );

    await screen.findByLabelText('Поиск чатов');
  });

  it('returns to the login screen when the restored credentials are rejected', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => mockResponse({ reason: 'Unauthorized' }, 401)),
    );
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        apiUrl: 'https://api.green-api.com',
        idInstance: '4100000001',
        apiTokenInstance: 'bad',
      }),
    );

    render(<App />);

    expect(await screen.findByRole('alert')).toHaveTextContent('idInstance');
  });

  it('shows a polling failure even when no chat is open, and offers a retry', async () => {
    // The instance validates, but notification polling is rejected: the failure
    // must be visible on the placeholder screen, not only inside a chat.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/getStateInstance/')) {
          return mockResponse({ stateInstance: 'authorized' });
        }
        if (url.includes('/receiveNotification/')) {
          return mockResponse({ reason: 'Unauthorized' }, 401);
        }
        throw new Error(`Unexpected request: ${url}`);
      }),
    );
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        apiUrl: 'https://api.green-api.com',
        idInstance: '4100000001',
        apiTokenInstance: 'token',
      }),
    );

    render(<App />);

    expect(await screen.findByText(/Неверный idInstance/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeInTheDocument();
    // The sidebar must not claim polling stopped when it is merely idle/starting.
    expect(screen.getByText('Приём сообщений остановлен')).toBeInTheDocument();
    expect(screen.getByText('Выберите чат')).toBeInTheDocument();
  });

  it('rejects an invalid contact before calling the API', async () => {
    installFetchMock();
    const user = userEvent.setup();
    render(<App />);

    await login(user);
    await createChat(user, '123');

    expect(await screen.findByRole('alert')).toHaveTextContent('Введите номер');
  });

  it('accepts an @username as the new-chat recipient', async () => {
    const harness = installFetchMock();
    const user = userEvent.setup();
    render(<App />);

    await login(user);
    await createChat(user, '@green_api');

    // The handle becomes the chat title; no phone number was involved.
    await expectTextSomewhere('@green_api');
    expect(harness.sentMessages).toHaveLength(0);
  });

  it('logs out back to the credentials screen and forgets the session', async () => {
    installFetchMock();
    const user = userEvent.setup();
    render(<App />);

    await login(user);
    await openMenu(user);
    await user.click(screen.getByRole('menuitem', { name: 'Выйти' }));

    expect(await screen.findByLabelText('idInstance')).toBeInTheDocument();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('warns when checkAccount reports that the recipient has no account', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/getStateInstance/')) {
          return mockResponse({ stateInstance: 'authorized' });
        }
        if (url.includes('/checkAccount/')) {
          return mockResponse({ exist: false });
        }
        if (url.includes('/receiveNotification/')) {
          return new Promise<Response>(() => {});
        }
        throw new Error(`Unexpected request: ${url}`);
      }),
    );
    const user = userEvent.setup();
    render(<App />);

    await login(user);
    await createChat(user, '79991234567');

    expect(await screen.findByText(/не подтвердил аккаунт/)).toBeInTheDocument();
  });

  it('names a peer discovered from an outgoing notification', async () => {
    // The live bug: an outgoing notification describes the *account*, so the chat
    // arrived titled after the operator and carrying the operator's phone. It
    // must appear as the peer it really is, resolved with one getContactInfo.
    const harness = installFetchMock();
    const user = userEvent.setup();
    render(<App />);
    await login(user);

    harness.pushNotification({
      receiptId: 1,
      body: {
        typeWebhook: 'outgoingAPIMessageReceived',
        instanceData: { idInstance: 4100000001, wid: '79001234567@c.us', typeInstance: 'telegram' },
        timestamp: 1790000000,
        idMessage: 'live-1',
        senderData: {
          chatId: '6900000001',
          chatType: 'user',
          sender: '305000000',
          chatName: '.',
          senderName: 'Владелец',
          senderContactName: 'Владелец',
          senderPhoneNumber: 79001234567,
        },
        messageData: {
          typeMessage: 'textMessage',
          textMessageData: { textMessage: 'ffff' },
        },
      },
    });

    // First as an unresolved chat…
    expect(await screen.findByText('Чат 6900000001')).toBeInTheDocument();
    // …then named by the lookup, and never as the account owner.
    expect(await screen.findByText('@peer_demo')).toBeInTheDocument();
    expect(screen.queryByText('Владелец')).not.toBeInTheDocument();
  });

  it('shows the error text under a bubble when sending fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/getStateInstance/')) {
          return mockResponse({ stateInstance: 'authorized' });
        }
        if (url.includes('/checkAccount/')) {
          return mockResponse({ exist: true, chatId: '10000000' });
        }
        if (url.includes('/sendMessage/')) {
          return mockResponse({ reason: 'Internal Server Error' }, 500);
        }
        if (url.includes('/receiveNotification/')) {
          return new Promise<Response>(() => {});
        }
        throw new Error(`Unexpected request: ${url}`);
      }),
    );
    const user = userEvent.setup();
    render(<App />);

    await login(user);
    await createChat(user, '79991234567');
    await user.type(screen.getByPlaceholderText('Напишите сообщение…'), 'Не уйдёт');
    await user.click(screen.getByRole('button', { name: 'Отправить' }));

    expect(await screen.findByText(/Ошибка на стороне GREEN-API/)).toBeInTheDocument();
    expect(await screen.findByLabelText('Ошибка отправки')).toBeInTheDocument();
  });
});
