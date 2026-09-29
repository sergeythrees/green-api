import { useEffect, useRef } from 'react';
import { GreenApiError } from '../api/greenApi';
import type { GreenApiClient } from '../api/greenApi';
import type { NotificationBody } from '../api/types';

export interface UseNotificationPollingOptions {
  /** Client to poll with; polling is off while `null`. */
  client: GreenApiClient | null;
  enabled: boolean;
  onNotification: (body: NotificationBody) => void;
  /** Called for retryable problems (network, 5xx, 429). */
  onError: (error: unknown) => void;
  /** Called for problems the user has to fix before polling can work. */
  onFatal: (error: unknown) => void;
}

/** Long-poll window; GREEN-API accepts 5..60 seconds. */
const RECEIVE_TIMEOUT_SECONDS = 10;
/** Pause after an empty long-poll, so an API that returns immediately is not hammered. */
const IDLE_DELAY_MS = 1000;
const BASE_BACKOFF_MS = 2000;
const MAX_BACKOFF_MS = 30_000;

function backoffFor(failures: number): number {
  return Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.min(failures - 1, 4));
}

/**
 * `receiveNotification` refuses to work while the instance has a custom
 * `webhookUrl`. The Telegram docs say the instance must be restarted through
 * `setSettings` and to wait about a minute for another attempt — and that
 * `setSettings` takes up to ~5 minutes to apply. That 400 therefore clears
 * itself and must not stop the loop.
 */
function isSelfHealingConfigurationError(error: unknown): boolean {
  if (!(error instanceof GreenApiError) || error.status !== 400) return false;
  return /webhook/i.test(`${error.message} ${error.details ?? ''}`);
}

/**
 * A stale `receiptId` makes `deleteNotification` answer HTTP 500
 * (`Cannot read properties of undefined (reading 'findUnAckedMessage')`) when
 * there is nothing left to remove. That is documented as "notification not
 * found", so it must not stop the polling loop.
 */
function isMissingNotificationError(error: unknown): boolean {
  return error instanceof GreenApiError && error.status === 500;
}

/**
 * Polls `receiveNotification` / `deleteNotification` in the documented order:
 * receive one notification, process it, then confirm it with
 * `deleteNotification` so the FIFO queue advances.
 *
 * The notification is confirmed even when `onNotification` throws: the reducer
 * is pure, and leaving a poison notification in the queue would block every
 * later message until it expires.
 */
export function useNotificationPolling({
  client,
  enabled,
  onNotification,
  onError,
  onFatal,
}: UseNotificationPollingOptions): void {
  const notificationRef = useRef(onNotification);
  const errorRef = useRef(onError);
  const fatalRef = useRef(onFatal);

  useEffect(() => {
    notificationRef.current = onNotification;
  }, [onNotification]);
  useEffect(() => {
    errorRef.current = onError;
  }, [onError]);
  useEffect(() => {
    fatalRef.current = onFatal;
  }, [onFatal]);

  useEffect(() => {
    if (!client || !enabled) return;

    const currentClient = client;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, ms);
      });

    const loop = async () => {
      let failures = 0;

      while (!cancelled) {
        try {
          const notification = await currentClient.receiveNotification(RECEIVE_TIMEOUT_SECONDS);
          if (cancelled) return;

          failures = 0;

          if (!notification) {
            await sleep(IDLE_DELAY_MS);
            continue;
          }

          try {
            // `body` can be absent on a malformed payload; it still has to be
            // acknowledged, otherwise the FIFO head never advances.
            if (notification.body) notificationRef.current(notification.body);
          } finally {
            // Always confirm, otherwise the same notification is redelivered.
            try {
              const confirmation = await currentClient.deleteNotification(notification.receiptId);

              if (confirmation.result !== true) {
                // The queue head was NOT removed, so the next receive returns the
                // same notification. Without a pause that is a tight loop against
                // the documented rate limits. A stale id is explicitly allowed to
                // answer `result: false`, so this is not fatal.
                failures += 1;
                errorRef.current(
                  new GreenApiError(
                    'GREEN-API не подтвердил удаление уведомления, очередь не продвигается.',
                    0,
                    confirmation.reason,
                  ),
                );
                await sleep(backoffFor(failures));
              }
            } catch (ackError) {
              if (!isMissingNotificationError(ackError)) throw ackError;

              // Nothing left to remove: the queue may already be free, but the
              // pause keeps an unacknowledgeable head from spinning.
              failures += 1;
              errorRef.current(ackError);
              await sleep(backoffFor(failures));
            }
          }
        } catch (error) {
          if (cancelled) return;

          // 4xx (except rate limiting) means the configuration is wrong and
          // retrying cannot help: credentials were rejected, or a custom
          // webhookUrl is still set on the instance.
          const needsUserAction =
            error instanceof GreenApiError &&
            error.status >= 400 &&
            error.status < 500 &&
            error.status !== 429 &&
            !isSelfHealingConfigurationError(error);

          if (needsUserAction) {
            fatalRef.current(error);
            return;
          }

          failures += 1;
          errorRef.current(error);
          await sleep(backoffFor(failures));
        }
      }
    };

    void loop();

    return () => {
      cancelled = true;
      // Drop the pending delay; the suspended loop is simply never resumed.
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [client, enabled]);
}
