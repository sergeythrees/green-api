import type { JSX } from 'react';
import { Button, Placeholder } from '@telegram-apps/telegram-ui';
import { Icon28Chat } from '@telegram-apps/telegram-ui/dist/icons/28/chat';

/**
 * Empty state of the conversation column.
 *
 * The kit's `Placeholder` already provides the centred illustration / header /
 * description / action stack, so only the icon and the copy are ours.
 */
export default function ChatPlaceholder({
  onNewChat,
}: {
  onNewChat: () => void;
}): JSX.Element {
  return (
    <div className="placeholder">
      <Placeholder
        header="Выберите чат"
        description="Откройте переписку слева или начните новую — по номеру телефона или @username."
        action={
          <Button mode="filled" onClick={onNewChat}>
            Новый чат
          </Button>
        }
      >
        <Icon28Chat width={72} height={72} className="placeholder__icon" />
      </Placeholder>
    </div>
  );
}
