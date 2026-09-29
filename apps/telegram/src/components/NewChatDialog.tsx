import { useEffect, useState } from 'react';
import type { FormEvent, JSX } from 'react';
import { Button, Headline, IconButton, Input } from '@telegram-apps/telegram-ui';
import { Icon24Close } from '@telegram-apps/telegram-ui/dist/icons/24/close';

/**
 * "New chat" dialog.
 *
 * The kit ships `Modal` — a controlled bottom sheet, the idiom of a Telegram Mini
 * App running inside another app. Telegram Web opens a centred card instead, and
 * the sheet's position comes from vaul's own transform, which cannot be
 * overridden from the stylesheet without fighting its open/close animation. So
 * the shell is ours (overlay + `role="dialog"`, Escape to close, click outside
 * to dismiss) while everything inside it is the kit's.
 */
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
  onSubmit: (contact: string) => void;
  onClose: () => void;
}): JSX.Element | null {
  const [contact, setContact] = useState('');

  useEffect(() => {
    if (!open) return;

    // Start from a clean field every time the dialog is opened.
    setContact('');

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(contact);
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
          <div className="dialog__head">
            <Headline weight="2" Component="h2">
              Новый чат
            </Headline>
            <IconButton
              type="button"
              mode="plain"
              size="s"
              aria-label="Закрыть"
              title="Закрыть"
              onClick={onClose}
            >
              <Icon24Close />
            </IconButton>
          </div>

          {error !== null && (
            <div className="dialog__error" role="alert">
              {error}
            </div>
          )}

          <Input
            className="new-chat__input"
            value={contact}
            placeholder="+7 999 123-45-67 или @username"
            aria-label="Номер телефона или @username"
            autoFocus
            spellCheck={false}
            onChange={(event) => setContact(event.target.value)}
          />

          <p className="dialog__note">
            Введите номер +7 999 123-45-67 или @username. Получатель будет проверен методом
            checkAccount, чтобы получить chatId.
          </p>

          <div className="dialog__actions">
            <Button type="button" mode="gray" stretched onClick={onClose} disabled={pending}>
              Отмена
            </Button>
            <Button type="submit" mode="filled" stretched loading={pending}>
              Создать чат
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
