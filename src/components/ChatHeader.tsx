import type { JSX } from 'react';
import { formatPhone } from '../api/phone';
import type { Chat } from '../store/chatStore';

function initialOf(title: string): string {
  return title.trim().charAt(0).toUpperCase() || '?';
}

export default function ChatHeader({ chat }: { chat: Chat }): JSX.Element {
  const subtitle = chat.chatId ? `MAX ID: ${chat.chatId}` : formatPhone(chat.phone);

  return (
    <header className="chat-header">
      <span className="avatar avatar--sm" aria-hidden="true">
        {initialOf(chat.title)}
      </span>
      <div className="chat-header__text">
        <h2 className="chat-header__title" title={chat.title}>
          {chat.title}
        </h2>
        <p className="chat-header__subtitle">{subtitle}</p>
      </div>
    </header>
  );
}
