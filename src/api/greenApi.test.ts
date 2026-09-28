import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_API_URL, GreenApiClient, GreenApiError, resolveChatByPhone } from './greenApi';
import { mockResponse } from '../test/response';

const credentials = {
  apiUrl: 'https://3100.api.green-api.com/',
  idInstance: '3100000001',
  apiTokenInstance: 'tok',
};

let fetchMock: ReturnType<typeof vi.fn>;

function calls(): [string, RequestInit][] {
  return fetchMock.mock.calls as [string, RequestInit][];
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GreenApiClient request building', () => {
  it('builds the documented sendMessage endpoint and body', async () => {
    fetchMock.mockResolvedValue(mockResponse({ idMessage: '42' }));

    const client = new GreenApiClient(credentials);
    await expect(client.sendMessage('10000000', 'Привет')).resolves.toEqual({ idMessage: '42' });

    const [url, init] = calls()[0];
    expect(url).toBe('https://3100.api.green-api.com/waInstance3100000001/sendMessage/tok');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(String(init.body))).toEqual({ chatId: '10000000', message: 'Привет' });
  });

  it('trims a trailing slash and falls back to the default host', () => {
    expect(new GreenApiClient(credentials).credentials.apiUrl).toBe(
      'https://3100.api.green-api.com',
    );
    expect(new GreenApiClient({ ...credentials, apiUrl: '   ' }).credentials.apiUrl).toBe(
      DEFAULT_API_URL,
    );
  });

  it('deletes a notification by receiptId using DELETE', async () => {
    fetchMock.mockResolvedValue(mockResponse({ result: true, reason: '' }));

    await new GreenApiClient(credentials).deleteNotification(1234567);

    const [url, init] = calls()[0];
    expect(url).toBe('https://3100.api.green-api.com/waInstance3100000001/deleteNotification/tok/1234567');
    expect(init.method).toBe('DELETE');
  });

  it('clears webhookUrl and enables incoming notifications for HTTP API mode', async () => {
    fetchMock.mockResolvedValue(mockResponse({ saveSettings: true }));

    await new GreenApiClient(credentials).enableHttpApiReceiving();

    const [url, init] = calls()[0];
    expect(url).toContain('/setSettings/tok');
    expect(JSON.parse(String(init.body))).toMatchObject({
      webhookUrl: '',
      incomingWebhook: 'yes',
    });
  });

  it('sends phoneNumber as a number, as the docs require', async () => {
    fetchMock.mockResolvedValue(mockResponse({ exist: true, chatId: '1' }));

    await resolveChatByPhone(new GreenApiClient(credentials), '79991234567');

    const [url, init] = calls()[0];
    expect(url).toContain('/checkAccount/tok');
    expect(JSON.parse(String(init.body))).toEqual({ phoneNumber: 79991234567 });
  });
});

describe('GreenApiClient receiveNotification', () => {
  it('returns null when the long poll ends with an empty response', async () => {
    fetchMock.mockResolvedValue(mockResponse(undefined));
    await expect(new GreenApiClient(credentials).receiveNotification()).resolves.toBeNull();
  });

  it('returns null for an empty JSON object', async () => {
    fetchMock.mockResolvedValue(mockResponse({}));
    await expect(new GreenApiClient(credentials).receiveNotification()).resolves.toBeNull();
  });

  it('clamps receiveTimeout into the documented 5..60 second range', async () => {
    fetchMock.mockResolvedValue(mockResponse(undefined));

    const client = new GreenApiClient(credentials);
    await client.receiveNotification(1);
    await client.receiveNotification(500);

    expect(calls()[0][0]).toContain('?receiveTimeout=5');
    expect(calls()[1][0]).toContain('?receiveTimeout=60');
  });

  it('parses a notification that carries a receiptId and body', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({ receiptId: 7, body: { typeWebhook: 'incomingMessageReceived' } }),
    );

    await expect(new GreenApiClient(credentials).receiveNotification()).resolves.toMatchObject({
      receiptId: 7,
    });
  });
});

describe('GreenApiClient error mapping', () => {
  it('turns a 401 into a credential error', async () => {
    fetchMock.mockResolvedValue(mockResponse({ reason: 'Unauthorized' }, 401));

    const error = await new GreenApiClient(credentials)
      .getStateInstance()
      .catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(GreenApiError);
    expect((error as GreenApiError).status).toBe(401);
    expect((error as GreenApiError).message).toContain('idInstance');
  });

  it('surfaces the documented reason for a 400', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({ reason: 'Message cannot be received because custom webhook url is set' }, 400),
    );

    const error = await new GreenApiClient(credentials)
      .receiveNotification()
      .catch((cause: unknown) => cause);

    expect((error as GreenApiError).message).toBe(
      'Message cannot be received because custom webhook url is set',
    );
    expect((error as GreenApiError).status).toBe(400);
  });

  it('reports a transport failure as status 0', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const error = await new GreenApiClient(credentials)
      .getStateInstance()
      .catch((cause: unknown) => cause);

    expect((error as GreenApiError).status).toBe(0);
    expect((error as GreenApiError).message).toContain('Нет связи');
  });
});

describe('resolveChatByPhone', () => {
  it('uses the numeric chatId returned by checkAccount', async () => {
    fetchMock.mockResolvedValue(mockResponse({ exist: true, chatId: '10000000', fromCache: true }));

    await expect(
      resolveChatByPhone(new GreenApiClient(credentials), '79991234567'),
    ).resolves.toEqual({ chatId: '10000000', source: 'checkAccount', exists: true });
  });

  it('falls back to the phone chatId when MAX has no account on the number', async () => {
    fetchMock.mockResolvedValue(mockResponse({ exist: false }));

    await expect(
      resolveChatByPhone(new GreenApiClient(credentials), '79991234567'),
    ).resolves.toEqual({ chatId: '79991234567@c.us', source: 'phone', exists: false });
  });

  it('never blocks the user when checkAccount itself fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await resolveChatByPhone(new GreenApiClient(credentials), '79991234567');

    expect(result).toMatchObject({
      chatId: '79991234567@c.us',
      source: 'phone',
      exists: null,
    });
    // The reason is surfaced to the caller instead of being swallowed.
    expect(result.reason).toContain('Нет связи');
  });

  it('reports the documented failure shape of checkAccount', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({ status: false, reason: 'User get contact info limit reached' }),
    );

    const result = await resolveChatByPhone(new GreenApiClient(credentials), '79991234567');

    expect(result).toMatchObject({ chatId: '79991234567@c.us', source: 'phone', exists: null });
    expect(result.reason).toBe('User get contact info limit reached');
  });
});
