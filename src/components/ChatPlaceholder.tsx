import type { JSX } from 'react';

export default function ChatPlaceholder({
  onNewChat,
}: {
  onNewChat: () => void;
}): JSX.Element {
  return (
    <div className="placeholder">
      <div className="logo-mark logo-mark--xl" aria-hidden="true" />
      <p className="placeholder__text">Выберите чат слева или создайте новый</p>
      <button type="button" className="button button--primary" onClick={onNewChat}>
        Новый чат
      </button>
    </div>
  );
}
