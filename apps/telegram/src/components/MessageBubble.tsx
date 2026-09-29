import type { JSX, ReactNode } from 'react';
import type { ChatMessage, OutgoingStatus } from '../store/chatStore';
import { IconTickError, IconTickOne, IconTickTwo, IconTickTwoAccent } from './icons';

/** `HH:MM` in 24-hour Russian locale. */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return '';
  }
}

/** Machine-readable timestamp, omitted when the value cannot be parsed. */
function isoOrUndefined(timestamp: number): string | undefined {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/*
 * Telegram links the bare `example.com` form as well as full URLs. The trailing
 * punctuation of a sentence ("…see example.com.") is not part of the address, so
 * it is split back off and left as plain text.
 */
const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>()]+/gi;
const TRAILING_PUNCTUATION = /[.,;:!?)\]]+$/;

function renderText(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const index = match.index ?? 0;
    const raw = match[0];
    const trailing = TRAILING_PUNCTUATION.exec(raw)?.[0] ?? '';
    const link = raw.slice(0, raw.length - trailing.length);

    if (index > lastIndex) parts.push(text.slice(lastIndex, index));
    if (link) {
      parts.push(
        <a
          key={`${index}-${link}`}
          className="bubble__link"
          href={link.startsWith('www.') ? `https://${link}` : link}
          target="_blank"
          rel="noreferrer noopener"
        >
          {link}
        </a>,
      );
    }
    if (trailing) parts.push(trailing);
    lastIndex = index + raw.length;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

interface StatusMarker {
  label: string;
  tone: 'plain' | 'read' | 'error';
  icon: JSX.Element;
}

/**
 * Delivery marker of an outgoing message.
 *
 * Telegram only has four documented webhook statuses, so `sending` and `sent`
 * share the single grey tick and everything the service reports maps one-to-one
 * onto the double tick / read tick / red exclamation.
 */
function statusMarker(status: OutgoingStatus | undefined): StatusMarker {
  switch (status) {
    case 'delivered':
      return { label: 'Доставлено', tone: 'plain', icon: <IconTickTwo /> };
    case 'read':
      return { label: 'Прочитано', tone: 'read', icon: <IconTickTwoAccent /> };
    case 'failed':
    case 'noAccount':
      return { label: 'Ошибка отправки', tone: 'error', icon: <IconTickError /> };
    case 'sent':
    case 'sending':
    case undefined:
    default:
      return { label: 'Отправлено', tone: 'plain', icon: <IconTickOne /> };
  }
}

/**
 * One message bubble.
 *
 * `isFirstOfBundle` / `isLastOfBundle` are an extension of the required
 * `{ message }` contract: the tail and the bundle corner geometry can only be
 * decided by `MessageList`, which is where the direction + 5-minute grouping
 * lives. Both default to `true`, so a standalone bubble is the natural fallback.
 */
export default function MessageBubble({
  message,
  isFirstOfBundle = true,
  isLastOfBundle = true,
}: {
  message: ChatMessage;
  isFirstOfBundle?: boolean;
  isLastOfBundle?: boolean;
}): JSX.Element {
  const outgoing = message.direction === 'outgoing';
  const marker = outgoing ? statusMarker(message.status) : null;

  const rowClass = [
    'message-row',
    outgoing ? 'message-row--outgoing' : 'message-row--incoming',
    isFirstOfBundle ? 'message-row--first' : '',
    isLastOfBundle ? 'message-row--last' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rowClass}>
      <div
        className={`bubble bubble--${outgoing ? 'outgoing' : 'incoming'}${
          isLastOfBundle ? ' bubble--tailed' : ''
        }`}
      >
        <span className="bubble__text">{renderText(message.text)}</span>
        <span className="bubble__meta">
          <time className="bubble__time" dateTime={isoOrUndefined(message.timestamp)}>
            {formatTime(message.timestamp)}
          </time>
          {marker && (
            <span
              className={`bubble__status bubble__status--${marker.tone}`}
              role="img"
              title={marker.label}
              aria-label={marker.label}
            >
              {marker.icon}
            </span>
          )}
        </span>

        {/* Only the last bubble of a bundle carries the tail; the corners the
            tail would cover are squared off in app.css. The `translate(9 -14)`
            wrapper is part of Telegram's own symbol definition — without it the
            path's negative coordinates fall outside the 0 0 11 20 viewBox. */}
        {isLastOfBundle && (
          <span className="bubble__tail" aria-hidden="true">
            <svg viewBox="0 0 11 20" fill="currentColor">
              <g transform="translate(9 -14)">
                <path
                  d="M-6 16h6v17c-.193-2.84-.876-5.767-2.05-8.782-.904-2.325-2.446-4.485-4.625-6.48A1 1 0 01-6 16z"
                  transform="matrix(1 0 0 -1 0 49)"
                />
              </g>
            </svg>
          </span>
        )}
      </div>

      {message.error !== undefined && message.error !== '' && (
        <p className="bubble__error">{message.error}</p>
      )}
    </div>
  );
}
