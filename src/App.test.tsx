import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { mockResponse } from './test/response';
import type { NotificationBody } from './api/types';

const incomingReply: NotificationBody = {
  typeWebhook: 'incomingMessageReceived',
  instanceData: { idInstance: 3100000001, wid: '79991234567@c.us', typeInstance: 'v3' },
  timestamp: 1763115200,
  idMessage: 'incoming-1',
  senderData: {
    chatId: '10000000',
    chatName: 'Получатель',
    sender: '10000000',
    senderName: 'Получатель',
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
 * Installs a fetch mock that speaks the GREEN-API MAX v3 protocol.
 *
 * `receiveNotification` parks (never resolves) until a notification is pushed,
 * which mirrors the real long poll without leaving timers behind.
 */
function installFetchMock(): Harness {
  const sentMessages: Array<{ chatId: string; message: string }> = [];
  const deletedReceiptIds: string[] = [];
  const queue: Array<{ receiptId: number; body: NotificationBody }> = [];
  const waiting: Array<(value: Response) => void> = [];

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (url.includes('/getStateInstance/')) {
      return mockResponse({ stateInstance: 'authorized' });
    }
    if (url.includes('/setSettings/')) {
      return mockResponse({ saveSettings: true });
    }
    if (url.includes('/checkAccount/')) {
      return mockResponse({ exist: true, chatId: '10000000', fromCache: true });
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
    await user.type(await screen.findByLabelText('idInstance'), '3100000001');
    await user.type(screen.getByLabelText('apiTokenInstance'), 'token');
    await user.click(screen.getByRole('button', { name: 'Подключиться' }));

    // 2. The chat screen opens and polling is running.
    expect(await screen.findByText('Инстанс 3100000001')).toBeInTheDocument();
    expect(screen.getByText('Приём сообщений')).toBeInTheDocument();

    // 3. The user enters the recipient's phone number and creates a chat.
    await user.click(screen.getAllByRole('button', { name: 'Новый чат' })[0]);
    await user.type(
      await screen.findByLabelText('Номер телефона получателя'),
      '79991234567',
    );
    await user.click(screen.getByRole('button', { name: 'Создать чат' }));

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

    // 5. The recipient answers in MAX; the app picks the reply up by polling.
    harness.pushNotification({ receiptId: 555, body: incomingReply });
    await expectTextSomewhere('Привет от получателя');

    // 6. The notification is confirmed so the FIFO queue advances.
    await waitFor(() => {
      expect(harness.deletedReceiptIds).toContain('555');
    });

    // 7. The peer's name replaces the temporary phone-number title.
    await expectTextSomewhere('Получатель');
  });

  it('restores a saved session without asking for credentials again', async () => {
    installFetchMock();
    window.localStorage.setItem(
      'green-api-max-chat:credentials',
      JSON.stringify({
        apiUrl: 'https://api.green-api.com',
        idInstance: '3100000001',
        apiTokenInstance: 'token',
      }),
    );

    render(<App />);

    expect(await screen.findByText('Инстанс 3100000001')).toBeInTheDocument();
    expect(screen.queryByLabelText('apiTokenInstance')).not.toBeInTheDocument();
  });

  it('restores a saved session under StrictMode double-invoked effects', async () => {
    // `main.tsx` renders inside <StrictMode>, which mounts, cleans up and
    // remounts every effect. A restore that is cancelled by that cleanup must
    // still complete on the second run instead of hanging on the splash.
    installFetchMock();
    window.localStorage.setItem(
      'green-api-max-chat:credentials',
      JSON.stringify({
        apiUrl: 'https://api.green-api.com',
        idInstance: '3100000001',
        apiTokenInstance: 'token',
      }),
    );

    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );

    expect(await screen.findByText('Инстанс 3100000001')).toBeInTheDocument();
    expect(screen.queryByText('Подключение…')).not.toBeInTheDocument();
  });

  it('returns to the login screen when the restored credentials are rejected', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => mockResponse({ reason: 'Unauthorized' }, 401)),
    );
    window.localStorage.setItem(
      'green-api-max-chat:credentials',
      JSON.stringify({
        apiUrl: 'https://api.green-api.com',
        idInstance: '3100000001',
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
      'green-api-max-chat:credentials',
      JSON.stringify({
        apiUrl: 'https://api.green-api.com',
        idInstance: '3100000001',
        apiTokenInstance: 'token',
      }),
    );

    render(<App />);

    expect(await screen.findByText(/Неверный idInstance/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeInTheDocument();
    // No chat is selected, so this is the placeholder screen.
    expect(screen.getByText('Выберите чат слева или создайте новый')).toBeInTheDocument();
    // The sidebar must not claim polling stopped when it is merely idle/starting.
    expect(screen.getByText('Приём остановлен')).toBeInTheDocument();
  });

  it('rejects an invalid phone number before calling the API', async () => {
    const harness = installFetchMock();
    const user = userEvent.setup();
    render(<App />);

    await user.type(await screen.findByLabelText('idInstance'), '3100000001');
    await user.type(screen.getByLabelText('apiTokenInstance'), 'token');
    await user.click(screen.getByRole('button', { name: 'Подключиться' }));
    await screen.findByText('Инстанс 3100000001');

    await user.click(screen.getAllByRole('button', { name: 'Новый чат' })[0]);
    await user.type(await screen.findByLabelText('Номер телефона получателя'), '123');
    await user.click(screen.getByRole('button', { name: 'Создать чат' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Введите номер');
    expect(harness.sentMessages).toHaveLength(0);
  });
});
