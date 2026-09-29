import type {
  CheckAccountResponse,
  GetContactInfoResponse,
  DeleteNotificationResponse,
  GetAccountSettingsResponse,
  GetStateInstanceResponse,
  NotificationBody,
  ReceiveNotificationResponse,
  SendMessageResponse,
  SetSettingsRequest,
  SetSettingsResponse,
} from './types';
import type { Recipient } from './phone';
import { phoneToChatId } from './phone';

export interface GreenApiCredentials {
  /**
   * Base host of the instance, e.g. `https://api.green-api.com` or a
   * cluster-specific host such as `https://4100.api.green-api.com`.
   */
  apiUrl: string;
  idInstance: string;
  apiTokenInstance: string;
}

/** Host used when the user does not override it from the GREEN-API cabinet. */
export const DEFAULT_API_URL = 'https://api.green-api.com';

/** Timeout bounds documented for `receiveNotification` (5..60 seconds). */
const MIN_RECEIVE_TIMEOUT = 5;
const MAX_RECEIVE_TIMEOUT = 60;

/** Default `receiveNotification` wait: short enough to react, long enough to avoid busy polling. */
const DEFAULT_RECEIVE_TIMEOUT = 10;

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
    // `checkAccount` nests the rate-limit explanation:
    // `{ "status": false, "data": { "reason": "rate_limit_exceeded", … } }`.
    const nested = toRecord(record.data);
    const nestedReason = nested?.reason;
    if (typeof nestedReason === 'string' && nestedReason.trim()) {
      return nestedReason.trim();
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
      return `Проблема с авторизацией (403). Проверьте idInstance и адрес API.${suffix}`;
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

/** Input accepted by `checkAccount`, mirroring the two documented lookup keys. */
export interface CheckAccountInput {
  /** Digits-only international phone number. */
  phone?: string;
  /** Username, with or without the leading `@`. */
  username?: string;
  /** Bypass the GREEN-API cache and query Telegram directly. */
  force?: boolean;
}

/**
 * Thin typed client over the GREEN-API Telegram HTTP API.
 *
 * Every method is a plain `fetch` so the client also works from the browser —
 * the API sends permissive CORS headers. The URL shape is the legacy
 * `/waInstance{id}/{method}/{token}` one: the Telegram product has **no**
 * `/telegram` path prefix, the product is determined by the instance.
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

  /**
   * Sends a text message.
   *
   * `chatId` is a plain string: positive for users (`"10000000"`), negative for
   * groups (`"-10000000000000"`), and `phoneNumber@c.us` only for backward
   * compatibility. `message` is limited to 4096 characters by the service.
   */
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
   * response once `receiveTimeout` elapses). Reading does not dequeue the
   * notification: it has to be confirmed with `deleteNotification`.
   */
  async receiveNotification(
    receiveTimeoutSeconds = DEFAULT_RECEIVE_TIMEOUT,
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

  setSettings(settings: SetSettingsRequest): Promise<SetSettingsResponse> {
    return this.request<SetSettingsResponse>('POST', this.endpoint('setSettings'), settings);
  }

  /** Account info of the authorised instance (no display name — see the docs). */
  getAccountSettings(): Promise<GetAccountSettingsResponse> {
    return this.request<GetAccountSettingsResponse>('GET', this.endpoint('getAccountSettings'));
  }

  /**
   * Looks up who a peer is.
   *
   * A notification carries the peer's `chatId` but almost never a usable name
   * — for a message the account sent itself, every name in `senderData` belongs
   * to the account, and for an unknown peer `name` comes back as `"."`. This
   * method is the documented way to learn the handle and the phone number, and
   * the app calls it once per newly discovered peer.
   */
  getContactInfo(chatId: string): Promise<GetContactInfoResponse> {
    return this.request<GetContactInfoResponse>('POST', this.endpoint('getContactInfo'), { chatId });
  }

  /**
   * Resolves a Telegram account by phone number or username.
   *
   * The response can also be a documented failure delivered with HTTP 200
   * (`{ "status": false, "reason": … }`), an HTTP 469 messenger-side rate limit,
   * or HTTP 500 while Telegram is unavailable — the caller decides how to
   * degrade, this method only reports the transport result.
   */
  checkAccount({ phone, username, force }: CheckAccountInput): Promise<CheckAccountResponse> {
    if (!phone && !username) {
      return Promise.reject(
        new GreenApiError(
          'Укажите номер телефона или имя пользователя для поиска.',
          0,
          undefined,
        ),
      );
    }

    const body: Record<string, unknown> = {};

    if (phone) {
      const value = Number(phone);
      if (!Number.isFinite(value) || value <= 0) {
        return Promise.reject(
          new GreenApiError('Некорректный номер телефона получателя.', 0, phone),
        );
      }
      body.phoneNumber = value;
    }

    if (username) {
      // The docs require the `@` prefix; tolerating its absence here keeps the
      // client usable from a plain text input.
      const value = username.startsWith('@') ? username : `@${username}`;
      body.username = value;
    }

    if (force) body.force = true;

    return this.request<CheckAccountResponse>('POST', this.endpoint('checkAccount'), body);
  }

  /**
   * Switches the instance to HTTP API delivery mode: `webhookUrl` must be empty
   * for `receiveNotification` to work, and notifications must be on.
   *
   * NOTE: `setSettings` restarts the instance and the docs say the change takes
   * effect within ~5 minutes, so `receiveNotification` can keep failing with
   * HTTP 400 (`custom webhook url is set`) for a while afterwards.
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
  /** chatId to send to: the real one when known, otherwise the fallback form. */
  chatId: string;
  /** Where `chatId` came from. */
  source: 'checkAccount' | 'phone' | 'username';
  /** `true`/`false` when Telegram answered, `null` when the check itself failed. */
  exists: boolean | null;
  /** Why the check fell back to the untrusted form, when it did. */
  reason?: string;
}

/** The fallback send target: `phoneNumber@c.us` or the `@username` handle. */
function fallbackTarget(contact: Recipient): {
  chatId: string;
  source: ResolvedChat['source'];
} {
  return contact.kind === 'username'
    ? { chatId: contact.value, source: 'username' }
    : { chatId: phoneToChatId(contact.value), source: 'phone' };
}

/** Reason of a documented `checkAccount` failure, including the nested shape. */
function failureReason(result: CheckAccountResponse): string | undefined {
  return result.reason ?? result.data?.reason;
}

/**
 * Resolves the recipient's canonical `chatId` from a phone number or username.
 *
 * The Telegram docs recommend always sending to the numeric `chatId` obtained
 * from `checkAccount`: a message sent to the legacy `phoneNumber@c.us` form is
 * counted as a *different chat* by the quota, and cannot be reliably matched
 * with incoming replies. If the check fails (rate limit 469, messenger
 * unavailable 500, `instance is starting`, …) we still fall back to the
 * untrusted form so the user is never blocked — but the reason is reported back
 * to the caller so it can be shown instead of being swallowed.
 */
export async function resolveChatByContact(
  client: GreenApiClient,
  contact: Recipient,
): Promise<ResolvedChat> {
  const fallback = (reason?: string): ResolvedChat => ({
    ...fallbackTarget(contact),
    exists: null,
    ...(reason ? { reason } : {}),
  });

  try {
    const result = await client.checkAccount(
      contact.kind === 'username' ? { username: contact.value } : { phone: contact.value },
    );

    // Documented failure shape: `{ "status": false, "reason": "…" }`.
    if (result.status === false) return fallback(failureReason(result));

    if (result.exist === true && result.chatId) {
      return { chatId: String(result.chatId), source: 'checkAccount', exists: true };
    }

    const reason = failureReason(result);
    return {
      ...fallbackTarget(contact),
      exists: result.exist ?? null,
      ...(reason ? { reason } : {}),
    };
  } catch (error) {
    return fallback(error instanceof GreenApiError ? error.message : undefined);
  }
}
