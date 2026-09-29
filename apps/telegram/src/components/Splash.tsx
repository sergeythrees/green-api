import type { JSX } from 'react';
import { Spinner } from '@telegram-apps/telegram-ui';

/**
 * First paint while a stored session is validated.
 *
 * The kit's spinner is the whole screen: the app has a single startup branch, so
 * there is nothing useful to show next to it.
 */
export default function Splash(): JSX.Element {
  return (
    <div className="splash">
      <Spinner size="l" />
    </div>
  );
}
