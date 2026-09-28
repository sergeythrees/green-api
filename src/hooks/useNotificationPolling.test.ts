import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useNotificationPolling } from './useNotificationPolling';
import { GreenApiError } from '../api/greenApi';
import type { GreenApiClient } from '../api/greenApi';
import type { NotificationBody } from '../api/types';

const body: NotificationBody = {
  typeWebhook: 'incomingMessageReceived',
  instanceData: { idInstance: 1, wid: '79991234567@c.us', typeInstance: 'v3' },
  timestamp: 1763115112,
  idMessage: 'msg-1',
  messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'Привет' } },
};

type ReceiveResult = { receiptId: number; body: NotificationBody } | null;

/**
 * Builds a client stub and keeps typed handles to the spies for assertions.
 *
 * The default `receive` serves the notification exactly once and then reports an
 * empty queue, so no test can spin the polling loop forever.
 */
function makeClient(options: {
  receive?: () => Promise<ReceiveResult>;
  remove?: (receiptId: number) => Promise<{ result: boolean }>;
} = {}) {
  let served = false;
  const receiveNotification = vi.fn(
    options.receive ??
      (async (): Promise<ReceiveResult> => {
        if (served) return null;
        served = true;
        return { receiptId: 42, body };
      }),
  );
  const deleteNotification = vi.fn(options.remove ?? (async () => ({ result: true })));
  const client = { receiveNotification, deleteNotification } as unknown as GreenApiClient;
  return { client, receiveNotification, deleteNotification };
}

const noop = () => undefined;

function renderPolling(client: GreenApiClient, overrides: Partial<Parameters<typeof useNotificationPolling>[0]> = {}) {
  return renderHook(() =>
    useNotificationPolling({
      client,
      enabled: true,
      onNotification: noop,
      onError: noop,
      onFatal: noop,
      ...overrides,
    }),
  );
}

describe('useNotificationPolling', () => {
  it('processes a notification and only then confirms it by receiptId', async () => {
    const order: string[] = [];
    let served = false;
    const { client, deleteNotification } = makeClient({
      receive: async () => {
        if (served) return null;
        served = true;
        order.push('receive');
        return { receiptId: 42, body };
      },
      remove: async (receiptId) => {
        order.push(`delete:${receiptId}`);
        return { result: true };
      },
    });
    const onNotification = vi.fn(() => order.push('notify'));

    renderPolling(client, { onNotification });

    await waitFor(() => expect(onNotification).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(deleteNotification).toHaveBeenCalledWith(42));

    // The documented order: receive -> process -> delete.
    expect(order.slice(0, 3)).toEqual(['receive', 'notify', 'delete:42']);
  });

  it('still confirms the notification when the handler throws', async () => {
    const { client, deleteNotification } = makeClient();
    const onNotification = vi.fn(() => {
      throw new Error('reducer blew up');
    });
    const onError = vi.fn();

    renderPolling(client, { onNotification, onError });

    // A poison notification must not block the FIFO queue for 24 hours.
    await waitFor(() => expect(deleteNotification).toHaveBeenCalledWith(42));
    await waitFor(() => expect(onError).toHaveBeenCalled());
  });

  it('does not spin when the service refuses to delete the notification', async () => {
    // `result: false` means the queue head was NOT removed, so the next receive
    // returns the same notification. Without a backoff this is a tight loop.
    const receiveNotification = vi.fn(async () => ({ receiptId: 99, body }));
    const deleteNotification = vi.fn(async () => ({ result: false }));
    const client = { receiveNotification, deleteNotification } as unknown as GreenApiClient;
    const onError = vi.fn();

    renderPolling(client, { onError });

    await waitFor(() => expect(onError).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(receiveNotification).toHaveBeenCalledTimes(1);
  });

  it('stops polling and reports a fatal error on a configuration 4xx', async () => {
    const receiveNotification = vi.fn(async (): Promise<ReceiveResult> => {
      throw new GreenApiError('Неверный idInstance или apiTokenInstance.', 401);
    });
    const client = { receiveNotification, deleteNotification: vi.fn() } as unknown as GreenApiClient;
    const onFatal = vi.fn();
    const onError = vi.fn();

    renderPolling(client, { onError, onFatal });

    await waitFor(() => expect(onFatal).toHaveBeenCalledTimes(1));
    // Retrying a rejected configuration cannot help, so the loop stops.
    expect(receiveNotification).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it('treats the "custom webhook url is set" 400 as retryable', async () => {
    // setSettings takes up to ~5 minutes to apply, so this 400 clears itself.
    const receiveNotification = vi.fn(async (): Promise<ReceiveResult> => {
      throw new GreenApiError(
        'Message cannot be received because custom webhook url is set',
        400,
        'webhook',
      );
    });
    const client = { receiveNotification, deleteNotification: vi.fn() } as unknown as GreenApiClient;
    const onFatal = vi.fn();
    const onError = vi.fn();

    renderPolling(client, { onError, onFatal });

    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(onFatal).not.toHaveBeenCalled();
  });

  it('keeps retrying and reports a retryable transport error', async () => {
    const receiveNotification = vi.fn(async (): Promise<ReceiveResult> => {
      throw new GreenApiError('Нет связи с GREEN-API', 0);
    });
    const client = { receiveNotification, deleteNotification: vi.fn() } as unknown as GreenApiClient;
    const onError = vi.fn();
    const onFatal = vi.fn();

    renderPolling(client, { onError, onFatal });

    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(onFatal).not.toHaveBeenCalled();
  });

  it('does not poll while it is disabled', async () => {
    const { client, receiveNotification } = makeClient();

    renderHook(() =>
      useNotificationPolling({
        client,
        enabled: false,
        onNotification: noop,
        onError: noop,
        onFatal: noop,
      }),
    );

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(receiveNotification).not.toHaveBeenCalled();
  });

  it('keeps polling after an empty long-poll response', async () => {
    let call = 0;
    const { client, receiveNotification } = makeClient({
      receive: async () => {
        call += 1;
        // Empty queue first, then one notification, then empty again.
        return call === 2 ? { receiptId: 7, body } : null;
      },
    });
    const onNotification = vi.fn();

    renderPolling(client, { onNotification });

    // The idle delay is 1s, so this needs a little more than the default timeout.
    await waitFor(() => expect(onNotification).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(receiveNotification.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
