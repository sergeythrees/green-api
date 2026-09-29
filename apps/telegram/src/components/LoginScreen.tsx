import { useState } from 'react';
import type { FormEvent, JSX } from 'react';
import {
  Button,
  Checkbox,
  Headline,
  IconButton,
  Input,
  Link,
  Text,
} from '@telegram-apps/telegram-ui';
import { DEFAULT_API_URL } from '../api/greenApi';
import type { StoredCredentials } from '../store/credentials';
import { IconEye, IconEyeOff, IconTelegramLogo } from './icons';

export interface LoginSubmission {
  apiUrl: string;
  idInstance: string;
  apiTokenInstance: string;
  configureReceiving: boolean;
  remember: boolean;
}

/**
 * Credentials screen.
 *
 * The kit owns every control (`Input`, `Checkbox`, `Button`, `IconButton`) and
 * the typography; only the Telegram logo mark and the card layout are ours.
 *
 * `configureReceiving` is off by default on purpose: enabling HTTP API delivery
 * calls `setSettings` with an empty `webhookUrl` and restarts the instance, and
 * the docs say the change can take up to five minutes. A login screen must not
 * silently restart the user's instance.
 */
export default function LoginScreen({
  initial,
  pending,
  error,
  onSubmit,
}: {
  initial: StoredCredentials | null;
  pending: boolean;
  error: string | null;
  onSubmit: (submission: LoginSubmission) => void;
}): JSX.Element {
  const [apiUrl, setApiUrl] = useState(initial?.apiUrl ?? DEFAULT_API_URL);
  const [idInstance, setIdInstance] = useState(initial?.idInstance ?? '');
  const [apiTokenInstance, setApiTokenInstance] = useState(initial?.apiTokenInstance ?? '');
  const [configureReceiving, setConfigureReceiving] = useState(false);
  const [remember, setRemember] = useState(true);
  const [tokenVisible, setTokenVisible] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit({ apiUrl, idInstance, apiTokenInstance, configureReceiving, remember });
  };

  return (
    <div className="login">
      <form className="login__card" onSubmit={handleSubmit}>
        <div className="login__brand">
          <IconTelegramLogo width={56} height={56} className="login__logo" />
          <div>
            <Headline weight="1" className="login__title">
              Telegram
            </Headline>
            <Text className="login__subtitle">Чат на GREEN-API</Text>
          </div>
        </div>

        {error !== null && (
          <div className="login__error" role="alert">
            {error}
          </div>
        )}

        <div className="field">
          <label className="field__label" htmlFor="login-api-url">
            Адрес API (apiUrl)
          </label>
          <Input
            id="login-api-url"
            className="field__input"
            value={apiUrl}
            onChange={(event) => setApiUrl(event.target.value)}
            autoComplete="url"
            spellCheck={false}
          />
          <p className="field__hint">Указан в личном кабинете GREEN-API рядом с idInstance</p>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="login-id-instance">
            idInstance
          </label>
          <Input
            id="login-id-instance"
            className="field__input"
            value={idInstance}
            onChange={(event) => setIdInstance(event.target.value)}
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="login-api-token">
            apiTokenInstance
          </label>
          <Input
            id="login-api-token"
            className="field__input"
            type={tokenVisible ? 'text' : 'password'}
            value={apiTokenInstance}
            onChange={(event) => setApiTokenInstance(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            after={
              <IconButton
                type="button"
                mode="plain"
                size="s"
                aria-label={tokenVisible ? 'Скрыть токен' : 'Показать токен'}
                title={tokenVisible ? 'Скрыть токен' : 'Показать токен'}
                onClick={() => setTokenVisible((visible) => !visible)}
              >
                {tokenVisible ? <IconEyeOff /> : <IconEye />}
              </IconButton>
            }
          />
        </div>

        <div className="check">
          <Checkbox
            id="login-configure-receiving"
            checked={configureReceiving}
            onChange={(event) => setConfigureReceiving(event.target.checked)}
          />
          <div className="check__body">
            <label className="check__text" htmlFor="login-configure-receiving">
              Включить приём уведомлений по HTTP API
            </label>
            <p className="check__hint">
              Очистит webhookUrl и включит входящие уведомления. setSettings перезапускает
              инстанс, изменения применяются до 5 минут.
            </p>
          </div>
        </div>

        <div className="check">
          <Checkbox
            id="login-remember"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
          />
          <div className="check__body">
            <label className="check__text" htmlFor="login-remember">
              Запомнить учётные данные
            </label>
          </div>
        </div>

        <Button type="submit" mode="filled" size="l" stretched loading={pending}>
          Подключиться
        </Button>

        <p className="login__note">
          Данные хранятся только в localStorage вашего браузера и отправляются напрямую в
          GREEN-API. Ключи и токен выдаёт{' '}
          <Link href="https://console.green-api.com" target="_blank" rel="noreferrer noopener">
            console.green-api.com
          </Link>
          .
        </p>
      </form>
    </div>
  );
}
