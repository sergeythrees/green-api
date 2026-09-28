import type { JSX } from 'react';
import type { ChatMessage, OutgoingStatus } from '../store/chatStore';

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

/** Inline check mark; `double` renders the delivered/read variant. */
export function CheckIcon({ double = false }: { double?: boolean }): JSX.Element {
  if (double) {
    return (
      <svg
        className="bubble__status-icon"
        width="18"
        height="12"
        viewBox="0 0 18 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M1 6.5 4 9.5 9.5 3" />
        <path d="M7.5 6.5 10.5 9.5 16 3" />
      </svg>
    );
  }

  return (
    <svg
      className="bubble__status-icon"
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M1.5 6.5 4.5 9.5 10.5 2.5" />
    </svg>
  );
}

interface StatusMarker {
  label: string;
  tone: 'plain' | 'read' | 'error';
  icon: JSX.Element;
}

function statusMarker(status: OutgoingStatus | undefined): StatusMarker {
  switch (status) {
    case 'sending':
      return {
        label: 'Отправка…',
        tone: 'plain',
        icon: <span className="bubble__clock" aria-hidden="true" />,
      };
    case 'delivered':
      return { label: 'Доставлено', tone: 'plain', icon: <CheckIcon double /> };
    case 'read':
      return { label: 'Прочитано', tone: 'read', icon: <CheckIcon double /> };
    case 'failed':
    case 'noAccount':
    case 'notInGroup':
      return {
        label: 'Ошибка отправки',
        tone: 'error',
        icon: <span className="bubble__bang">!</span>,
      };
    case 'sent':
    case undefined:
    default:
      return { label: 'Отправлено', tone: 'plain', icon: <CheckIcon /> };
  }
}

export default function MessageBubble({ message }: { message: ChatMessage }): JSX.Element {
  const outgoing = message.direction === 'outgoing';
  const marker = outgoing ? statusMarker(message.status) : null;

  return (
    <div className={`message-row${outgoing ? ' message-row--outgoing' : ' message-row--incoming'}`}>
      <div className={`bubble bubble--${outgoing ? 'outgoing' : 'incoming'}`}>
        <span className="bubble__text">{message.text}</span>
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
      </div>
      {message.error !== undefined && message.error !== '' && (
        <p className="bubble__error">{message.error}</p>
      )}
    </div>
  );
}
