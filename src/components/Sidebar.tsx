import type { JSX } from 'react';
import type { Chat } from '../store/chatStore';

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

function previewOf(chat: Chat): string {
  const last = chat.messages.at(-1);
  if (!last) return '';
  const prefix = last.direction === 'outgoing' ? 'Вы: ' : '';
  return `${prefix}${last.text}`;
}

function initialOf(title: string): string {
  return title.trim().charAt(0).toUpperCase() || '?';
}

export default function Sidebar({
  chats,
  activeChatKey,
  instanceLabel,
  polling,
  onSelect,
  onNewChat,
  onLogout,
}: {
  chats: Chat[];
  activeChatKey: string | null;
  instanceLabel: string;
  polling: boolean;
  onSelect: (key: string) => void;
  onNewChat: () => void;
  onLogout: () => void;
}): JSX.Element {
  return (
    <aside className="sidebar">
      <header className="sidebar__header">
        <div className="logo-mark logo-mark--sm" aria-hidden="true" />
        <span className="sidebar__instance" title={instanceLabel}>
          {instanceLabel}
        </span>
        <button
          type="button"
          className="icon-button"
          aria-label="Выйти"
          title="Выйти"
          onClick={onLogout}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="M16 17l5-5-5-5" />
            <path d="M21 12H9" />
          </svg>
        </button>
      </header>

      <div className="sidebar__actions">
        <button type="button" className="button button--primary button--block" onClick={onNewChat}>
          Новый чат
        </button>
      </div>

      <div className={`sidebar__status${polling ? '' : ' sidebar__status--stopped'}`}>
        <span className="sidebar__status-dot" aria-hidden="true" />
        <span>{polling ? 'Приём сообщений' : 'Приём остановлен'}</span>
      </div>

      <div className="sidebar__list">
        {chats.length === 0 ? (
          <p className="sidebar__empty">Нет чатов. Создайте новый чат по номеру телефона.</p>
        ) : (
          chats.map((chat) => {
            const isActive = chat.key === activeChatKey;
            const preview = previewOf(chat);
            return (
              <button
                key={chat.key}
                type="button"
                className={`chat-item${isActive ? ' chat-item--active' : ''}`}
                aria-current={isActive ? 'true' : undefined}
                onClick={() => onSelect(chat.key)}
              >
                <span className="avatar" aria-hidden="true">
                  {initialOf(chat.title)}
                </span>
                <span className="chat-item__body">
                  <span className="chat-item__row">
                    <span className="chat-item__title">{chat.title}</span>
                    <span className="chat-item__time">{formatTime(chat.lastActivity)}</span>
                  </span>
                  <span className="chat-item__row">
                    <span className="chat-item__preview">{preview}</span>
                    {chat.unread > 0 && <span className="badge">{chat.unread}</span>}
                  </span>
                </span>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
