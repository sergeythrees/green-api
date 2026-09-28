import { useState, useEffect } from 'react';
import type { FormEvent, JSX } from 'react';

export default function NewChatDialog({
  open,
  pending,
  error,
  onSubmit,
  onClose,
}: {
  open: boolean;
  pending: boolean;
  error: string | null;
  onSubmit: (phone: string) => void;
  onClose: () => void;
}): JSX.Element | null {
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (!open) return;

    // Start from a clean field every time the dialog is opened.
    setPhone('');

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(phone);
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Новый чат"
        onClick={(event) => event.stopPropagation()}
      >
        <form className="dialog__form" onSubmit={handleSubmit}>
          <h2 className="dialog__title">Новый чат</h2>

          {error !== null && (
            <div className="dialog__error" role="alert">
              {error}
            </div>
          )}

          <div className="field">
            <label className="field__label" htmlFor="new-chat-phone">
              Номер телефона получателя
            </label>
            <input
              id="new-chat-phone"
              className="field__input"
              type="tel"
              inputMode="tel"
              placeholder="+7 999 123-45-67"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              autoFocus
              spellCheck={false}
            />
          </div>

          <p className="dialog__note">
            Номер будет проверен методом checkAccount, чтобы получить chatId получателя.
          </p>

          <div className="dialog__actions">
            <button
              type="button"
              className="button button--ghost"
              onClick={onClose}
              disabled={pending}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="button button--primary"
              disabled={pending}
            >
              {pending ? 'Проверка…' : 'Создать чат'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
