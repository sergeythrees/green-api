import type {
  CheckAccountResponse,
  DeleteNotificationResponse,
  GetStateInstanceResponse,
  InstanceSettings,
  NotificationBody,
  ReceiveNotificationResponse,
  SendMessageResponse,
  SetSettingsResponse,
} from './types';
import { phoneToChatId } from './phone';

export interface GreenApiCredentials {
  /**
   * Base host of the instance, e.g. `https://api.green-api.com` or a
   * cluster-specific host such as `https://3100.api.green-api.com`.
   */
  apiUrl: string;
  idInstance: string;
  apiTokenInstance: string;
}

/** Host used when the user does not override it from the GREEN-API cabinet. */
export const DEFAULT_API_URL = 'https://api.green-api.com';

/** Timeout bounds documented for `receiveNotification`. */
const MIN_RECEIVE_TIMEOUT = 5;
const MAX_RECEIVE_TIMEOUT = 60;

export class GreenApiError extends Error {
  /** HTTP status, or `0` when the request never reached the server. */
  readonly status: number;
  readonly details?: string;

  constructor(message: string, status: number, details?: string) {
    super(message);
    this.name = 'GreenApiError';
    this.status = status;
    this.details = details;
  }
}

function parseJson(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function extractDetails(parsed: unknown, raw: string): string | undefined {
  const record = toRecord(parsed);
  if (record) {
    for (const key of ['reason', 'message', 'description', 'error']) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  }
  const trimmed = raw.trim();
  return trimmed ? trimmed.slice(0, 400) : undefined;
}

function friendlyMessage(status: number, details?: string): string {
  const suffix = details ? ` Подробности: ${details}` : '';
  switch (status) {
    case 0:
      return 'Нет связи с GREEN-API. Проверьте интернет-соединение и адрес API.';
    case 400:
      return details ?? 'GREEN-API отклонил запрос (400).';
    case 401:
      return `Неверный idInstance или apiTokenInstance.${suffix}`;
    case 403:
      return `Аккаунт MAX временно ограничен: отправка возможна только на сохранённые контакты.${suffix}`;
    case 404:
      return `Метод не найден. Проверьте адрес API (apiUrl).${suffix}`;
    case 429:
      return `Превышен лимит запросов к GREEN-API. Подождите и повторите.${suffix}`;
    case 466:
      return `Достигнут лимит тарифа «Разработчик».${suffix}`;
    case 469:
      return `Достигнут лимит проверки контактов, повторите через 2 часа.${suffix}`;
    default:
      if (status >= 500) {
        return `Ошибка на стороне GREEN-API (HTTP ${status}). Попробуйте позже.${suffix}`;
      }
      return `Ошибка GREEN-API (HTTP ${status}).${suffix}`;
  }
}

interface RequestOptions {
  /**
   * Permit a successful response with an empty body.
   *
   * Only `receiveNotification` needs this: the documented "queue is empty"
   * answer is an empty response.
   */
  allowEmpty?: boolean;
}

/**
 * Thin typed client over the GREEN-API MAX v3 HTTP API.
 *
 * Every method is a plain `fetch` so the client also works from the browser —
 * the API sends permissive CORS headers.
 */
export class GreenApiClient {
  readonly credentials: GreenApiCredentials;
  private readonly base: string;

  constructor(credentials: GreenApiCredentials) {
    const base = (credentials.apiUrl.trim() || DEFAULT_API_URL).replace(/\/+$/, '');
    this.base = base;
    this.credentials = { ...credentials, apiUrl: base };
  }

  private endpoint(method: string, suffix = ''): string {
    const { idInstance, apiTokenInstance } = this.credentials;
    return `${this.base}/waInstance${idInstance}/${method}/${apiTokenInstance}${suffix}`;
  }

  private async request<T>(
    httpMethod: 'GET' | 'POST' | 'DELETE',
    url: string,
    body?: unknown,
    options: RequestOptions = {},
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetch(url, {
        method: httpMethod,
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (cause) {
      throw new GreenApiError(
        friendlyMessage(0),
        0,
        cause instanceof Error ? cause.message : String(cause),
      );
    }

    const raw = await response.text();
    const parsed = parseJson(raw);

    if (!response.ok) {
      const details = extractDetails(parsed, raw);
      throw new GreenApiError(friendlyMessage(response.status, details), response.status, details);
    }

    // A success status still has to carry a JSON object: an HTML error page or
    // a truncated body would otherwise reach the caller as a raw TypeError
    // (e.g. "Cannot destructure property 'idMessage' of null").
    if (parsed === null || typeof parsed !== 'object') {
      if (options.allowEmpty) return parsed as T;
      throw new GreenApiError(
        'GREEN-API вернул некорректный ответ. Проверьте адрес API (apiUrl) и состояние инстанса.',
        response.status,
        extractDetails(parsed, raw),
      );
    }

    return parsed as T;
  }

  /** Sends a text message. `chatId` may be numeric or `phone@c.us`. */
  sendMessage(chatId: string, message: string): Promise<SendMessageResponse> {
    return this.request<SendMessageResponse>('POST', this.endpoint('sendMessage'), {
      chatId,
      message,
    });
  }

  /**
   * Long-polls for one notification.
   *
   * Resolves with `null` when the queue is empty (the call ends with an empty
   * response once `receiveTimeout` elapses).
   */
  async receiveNotification(
    receiveTimeoutSeconds = MIN_RECEIVE_TIMEOUT,
  ): Promise<ReceiveNotificationResponse | null> {
    const timeout = Math.min(
      MAX_RECEIVE_TIMEOUT,
      Math.max(MIN_RECEIVE_TIMEOUT, Math.trunc(receiveTimeoutSeconds)),
    );

    const result = await this.request<Record<string, unknown> | null>(
      'GET',
      this.endpoint('receiveNotification', `?receiveTimeout=${timeout}`),
      undefined,
      { allowEmpty: true },
    );

    // Truly empty response: the queue is empty.
    if (!result) return null;

    // Only a numeric receiptId can be acknowledged via deleteNotification.
    // Returning it anyway lets the caller confirm the notification instead of
    // stalling the FIFO head; an unacknowledgeable payload is skipped.
    const receiptId = Number(result.receiptId);
    if (!Number.isFinite(receiptId)) return null;

    return { receiptId, body: result.body as NotificationBody | undefined };
  }

  /** Confirms a notification so it is removed from the FIFO queue. */
  deleteNotification(receiptId: number): Promise<DeleteNotificationResponse> {
    return this.request<DeleteNotificationResponse>(
      'DELETE',
      this.endpoint('deleteNotification', `/${receiptId}`),
    );
  }

  /** Returns the instance state; also used to validate credentials. */
  getStateInstance(): Promise<GetStateInstanceResponse> {
    return this.request<GetStateInstanceResponse>('GET', this.endpoint('getStateInstance'));
  }

  setSettings(settings: InstanceSettings): Promise<SetSettingsResponse> {
    return this.request<SetSettingsResponse>('POST', this.endpoint('setSettings'), settings);
  }

  /** Checks whether a MAX account exists for a phone number and returns its chatId. */
  checkAccount(phoneNumber: string, force = false): Promise<CheckAccountResponse> {
    const value = Number(phoneNumber);
    if (!Number.isFinite(value) || value <= 0) {
      return Promise.reject(
        new GreenApiError('Некорректный номер телефона получателя.', 0, phoneNumber),
      );
    }
    return this.request<CheckAccountResponse>('POST', this.endpoint('checkAccount'), {
      phoneNumber: value,
      ...(force ? { force: true } : {}),
    });
  }

  /**
   * Switches the instance to HTTP API delivery mode: `webhookUrl` must be empty
   * for `receiveNotification` to work, and incoming notifications must be on.
   */
  enableHttpApiReceiving(): Promise<SetSettingsResponse> {
    return this.setSettings({
      webhookUrl: '',
      incomingWebhook: 'yes',
      outgoingWebhook: 'yes',
      outgoingAPIMessageWebhook: 'yes',
      outgoingMessageWebhook: 'yes',
    });
  }
}

export interface ResolvedChat {
  /** chatId to send to: the real one when known, otherwise `phone@c.us`. */
  chatId: string;
  /** Where `chatId` came from. */
  source: 'checkAccount' | 'phone';
  /** `true`/`false` when MAX answered, `null` when the check itself failed. */
  exists: boolean | null;
  /** Why the check fell back to the phone form, when it did. */
  reason?: string;
}

/**
 * Resolves the recipient's canonical `chatId` from a phone number.
 *
 * GREEN-API recommends sending to the numeric `chatId` from `checkAccount`
 * because messages sent to `phone@c.us` cannot be reliably matched with
 * incoming replies. If the check fails we still fall back to the phone form so
 * the user is never blocked — but the reason is reported back to the caller so
 * it can be shown instead of being swallowed.
 */
export async function resolveChatByPhone(
  client: GreenApiClient,
  phone: string,
): Promise<ResolvedChat> {
  const fallback = (reason?: string): ResolvedChat => ({
    chatId: phoneToChatId(phone),
    source: 'phone',
    exists: null,
    ...(reason ? { reason } : {}),
  });

  try {
    const result = await client.checkAccount(phone);

    // Documented failure shape: `{ "status": false, "reason": "…" }`.
    if (result.status === false) return fallback(result.reason);

    if (result.exist === true && result.chatId) {
      return { chatId: String(result.chatId), source: 'checkAccount', exists: true };
    }

    return {
      chatId: phoneToChatId(phone),
      source: 'phone',
      exists: result.exist ?? null,
      ...(result.reason ? { reason: result.reason } : {}),
    };
  } catch (error) {
    return fallback(error instanceof GreenApiError ? error.message : undefined);
  }
}
