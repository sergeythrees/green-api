import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppRoot, Button, Text } from '@telegram-apps/telegram-ui';

/**
 * Smoke test for the third-party kit itself.
 *
 * The data-layer tests never import it, so this is the only thing that proves
 * `@telegram-apps/telegram-ui` 2.1.13 renders under the React version this
 * workspace resolves. `AppRoot` is part of the assertion because the kit's
 * theme variables only exist below it.
 */
describe('@telegram-apps/telegram-ui smoke', () => {
  it('renders inside AppRoot under the current React version', () => {
    render(
      <AppRoot appearance="light">
        <Button>Привет</Button>
        <Text>Текст</Text>
      </AppRoot>,
    );

    expect(screen.getByRole('button', { name: 'Привет' })).toBeInTheDocument();
  });
});
