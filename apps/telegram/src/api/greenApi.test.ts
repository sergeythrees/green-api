import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_API_URL,
  GreenApiClient,
  GreenApiError,
  resolveChatByContact,
} from './greenApi';
import { mockResponse } from '../test/response';

const credentials = {
  apiUrl: 'https://4100.api.green-api.com/',
  idInstance: '4100000000',
  apiTokenInstance: 'tok',
};

const PHONE_CONTACT = { kind: 'phone', value: '79991234567' } as const;
const USERNAME_CONTACT = { kind: 'username', value: '@green_api' } as const;

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
    fetchMock.mockResolvedValue(mockResponse({ idMessage: '1769676078000' }));

    const client = new GreenApiClient(credentials);
    await expect(client.sendMessage('10000000', 'Привет')).resolves.toEqual({
      idMessage: '1769676078000',
    });

    const [url, init] = calls()[0];
    expect(url).toBe('https://4100.api.green-api.com/waInstance4100000000/sendMessage/tok');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(String(init.body))).toEqual({ chatId: '10000000', message: 'Привет' });
  });

  it('keeps a negative group chatId as a string', async () => {
    fetchMock.mockResolvedValue(mockResponse({ idMessage: '1' }));

    await new GreenApiClient(credentials).sendMessage('-10000000000000', 'Всем привет');

    const [, init] = calls()[0];
    expect(JSON.parse(String(init.body))).toEqual({
      chatId: '-10000000000000',
      message: 'Всем привет',
    });
  });

  it('trims a trailing slash and falls back to the default host', () => {
    expect(new GreenApiClient(credentials).credentials.apiUrl).toBe(
      'https://4100.api.green-api.com',
    );
    expect(new GreenApiClient({ ...credentials, apiUrl: '   ' }).credentials.apiUrl).toBe(
      DEFAULT_API_URL,
    );
  });

  it('deletes a notification by receiptId using DELETE', async () => {
    fetchMock.mockResolvedValue(mockResponse({ result: true, reason: '' }));

    await new GreenApiClient(credentials).deleteNotification(1234567);

    const [url, init] = calls()[0];
    expect(url).toBe(
      'https://4100.api.green-api.com/waInstance4100000000/deleteNotification/tok/1234567',
    );
    expect(init.method).toBe('DELETE');
  });

  it('builds the getStateInstance and getAccountSettings endpoints', async () => {
    fetchMock.mockResolvedValue(mockResponse({ stateInstance: 'authorized' }));

    const client = new GreenApiClient(credentials);
    await client.getStateInstance();
    await client.getAccountSettings();

    expect(calls()[0][0]).toBe(
      'https://4100.api.green-api.com/waInstance4100000000/getStateInstance/tok',
    );
    expect(calls()[1][0]).toBe(
      'https://4100.api.green-api.com/waInstance4100000000/getAccountSettings/tok',
    );
    expect(calls()[0][1].body).toBeUndefined();
  });

  it('clears webhookUrl and enables notifications for HTTP API mode', async () => {
    fetchMock.mockResolvedValue(mockResponse({ saveSettings: true }));

    await new GreenApiClient(credentials).enableHttpApiReceiving();

    const [url, init] = calls()[0];
    expect(url).toContain('/setSettings/tok');
    expect(JSON.parse(String(init.body))).toMatchObject({
      webhookUrl: '',
      incomingWebhook: 'yes',
      outgoingWebhook: 'yes',
      outgoingAPIMessageWebhook: 'yes',
      outgoingMessageWebhook: 'yes',
    });
  });

  it('sends phoneNumber as a number, as the docs require', async () => {
    fetchMock.mockResolvedValue(mockResponse({ exist: true, chatId: '10000000' }));

    await new GreenApiClient(credentials).checkAccount({ phone: '79991234567' });

    const [url, init] = calls()[0];
    expect(url).toContain('/checkAccount/tok');
    expect(JSON.parse(String(init.body))).toEqual({ phoneNumber: 79991234567 });
  });

  it('normalises the username prefix and forwards force', async () => {
    fetchMock.mockResolvedValue(mockResponse({ exist: true, chatId: '10000000' }));

    const client = new GreenApiClient(credentials);
    await client.checkAccount({ username: 'green_api', force: true });
    await client.checkAccount({ username: '@other' });

    expect(JSON.parse(String(calls()[0][1].body))).toEqual({
      username: '@green_api',
      force: true,
    });
    expect(JSON.parse(String(calls()[1][1].body))).toEqual({ username: '@other' });
  });

  it('rejects checkAccount without a lookup key', async () => {
    const error = await new GreenApiClient(credentials)
      .checkAccount({})
      .catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(GreenApiError);
    expect((error as GreenApiError).message).toContain('Укажите номер');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an unusable phone number before calling the API', async () => {
    const error = await new GreenApiClient(credentials)
      .checkAccount({ phone: 'не номер' })
      .catch((cause: unknown) => cause);

    expect((error as GreenApiError).message).toContain('Некорректный номер');
    expect(fetchMock).not.toHaveBeenCalled();
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

  it('defaults to a 10 second wait and clamps it into 5..60', async () => {
    fetchMock.mockResolvedValue(mockResponse(undefined));

    const client = new GreenApiClient(credentials);
    await client.receiveNotification();
    await client.receiveNotification(1);
    await client.receiveNotification(500);

    expect(calls()[0][0]).toContain('?receiveTimeout=10');
    expect(calls()[1][0]).toContain('?receiveTimeout=5');
    expect(calls()[2][0]).toContain('?receiveTimeout=60');
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

  it('explains the 469 contact-check rate limit', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({ status: false, reason: 'Rate limited by messenger' }, 469),
    );

    const error = await new GreenApiClient(credentials)
      .checkAccount({ phone: '79991234567' })
      .catch((cause: unknown) => cause);

    expect((error as GreenApiError).status).toBe(469);
    expect((error as GreenApiError).message).toContain('лимит проверки контактов');
  });

  it('explains the 466 Developer-tariff limit', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({ invokeStatus: { status: 'QUOTE_EXCEEDED', description: 'quota' } }, 466),
    );

    const error = await new GreenApiClient(credentials)
      .sendMessage('10000000', 'Привет')
      .catch((cause: unknown) => cause);

    expect((error as GreenApiError).status).toBe(466);
    expect((error as GreenApiError).message).toContain('тарифа');
  });

  it('reports a transport failure as status 0', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const error = await new GreenApiClient(credentials)
      .getStateInstance()
      .catch((cause: unknown) => cause);

    expect((error as GreenApiError).status).toBe(0);
    expect((error as GreenApiError).message).toContain('Нет связи');
  });

  it('rejects a 2xx answer that is not a JSON object', async () => {
    fetchMock.mockResolvedValue(mockResponse('not json'));

    const error = await new GreenApiClient(credentials)
      .sendMessage('10000000', 'Привет')
      .catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(GreenApiError);
    expect((error as GreenApiError).message).toContain('некорректный ответ');
  });
});

describe('resolveChatByContact', () => {
  it('uses the numeric chatId returned by checkAccount', async () => {
    fetchMock.mockResolvedValue(mockResponse({ exist: true, chatId: '10000000', fromCache: true }));

    await expect(
      resolveChatByContact(new GreenApiClient(credentials), PHONE_CONTACT),
    ).resolves.toEqual({ chatId: '10000000', source: 'checkAccount', exists: true });
  });

  it('falls back to the legacy phone chatId when Telegram has no account', async () => {
    fetchMock.mockResolvedValue(mockResponse({ exist: false, chatId: '' }));

    await expect(
      resolveChatByContact(new GreenApiClient(credentials), PHONE_CONTACT),
    ).resolves.toEqual({ chatId: '79991234567@c.us', source: 'phone', exists: false });
  });

  it('falls back to the @username form for a username lookup', async () => {
    fetchMock.mockResolvedValue(mockResponse({ exist: false, chatId: '' }));

    await expect(
      resolveChatByContact(new GreenApiClient(credentials), USERNAME_CONTACT),
    ).resolves.toEqual({ chatId: '@green_api', source: 'username', exists: false });
  });

  it('reports the documented failure shape of checkAccount', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({ status: false, reason: 'instance is starting or not authorized' }),
    );

    const result = await resolveChatByContact(new GreenApiClient(credentials), PHONE_CONTACT);

    expect(result).toMatchObject({
      chatId: '79991234567@c.us',
      source: 'phone',
      exists: null,
    });
    expect(result.reason).toBe('instance is starting or not authorized');
  });

  it('reads the reason nested under data for the rate-limit shape', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({
        status: false,
        data: { status: 'fail', reason: 'rate_limit_exceeded', retryAfter: 11930619 },
      }),
    );

    const result = await resolveChatByContact(new GreenApiClient(credentials), PHONE_CONTACT);

    expect(result.reason).toBe('rate_limit_exceeded');
    expect(result.exists).toBeNull();
  });

  it('never blocks the user when checkAccount itself fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await resolveChatByContact(new GreenApiClient(credentials), PHONE_CONTACT);

    expect(result).toMatchObject({
      chatId: '79991234567@c.us',
      source: 'phone',
      exists: null,
    });
    // The reason is surfaced to the caller instead of being swallowed.
    expect(result.reason).toContain('Нет связи');
  });

  it('reports a 469 rate limit as a readable reason', async () => {
    fetchMock.mockResolvedValue(mockResponse({ status: false, reason: 'Rate limited' }, 469));

    const result = await resolveChatByContact(new GreenApiClient(credentials), USERNAME_CONTACT);

    expect(result).toMatchObject({ chatId: '@green_api', source: 'username', exists: null });
    expect(result.reason).toContain('лимит проверки контактов');
  });
});
