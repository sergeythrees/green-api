import { useState, type FormEvent, type JSX } from 'react';
import type { StoredCredentials } from '../store/credentials';
import { DEFAULT_API_URL } from '../api/greenApi';

export interface LoginSubmission {
  apiUrl: string;
  idInstance: string;
  apiTokenInstance: string;
  configureReceiving: boolean;
  remember: boolean;
}

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
  const [configureReceiving, setConfigureReceiving] = useState(true);
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
          <div className="logo-mark logo-mark--lg" aria-hidden="true" />
          <div>
            <h1 className="login__title">MAX</h1>
            <p className="login__subtitle">Чат на GREEN-API</p>
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
          <input
            id="login-api-url"
            className="field__input"
            type="text"
            value={apiUrl}
            onChange={(event) => setApiUrl(event.target.value)}
            autoComplete="url"
            spellCheck={false}
          />
          <p className="field__hint">
            Указан в личном кабинете GREEN-API рядом с idInstance
          </p>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="login-id-instance">
            idInstance
          </label>
          <input
            id="login-id-instance"
            className="field__input"
            type="text"
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
          <div className="field__row">
            <input
              id="login-api-token"
              className="field__input"
              type={tokenVisible ? 'text' : 'password'}
              value={apiTokenInstance}
              onChange={(event) => setApiTokenInstance(event.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              className="button button--ghost"
              aria-label={tokenVisible ? 'Скрыть токен' : 'Показать токен'}
              onClick={() => setTokenVisible((visible) => !visible)}
            >
              {tokenVisible ? 'Скрыть' : 'Показать'}
            </button>
          </div>
        </div>

        <div className="check">
          <label className="check__label" htmlFor="login-configure-receiving">
            <input
              id="login-configure-receiving"
              className="check__input"
              type="checkbox"
              checked={configureReceiving}
              onChange={(event) => setConfigureReceiving(event.target.checked)}
            />
            <span>Настроить инстанс для приёма сообщений (HTTP API)</span>
          </label>
          <p className="field__hint">
            Очистит webhookUrl и включит входящие уведомления. Инстанс перезапустится,
            настройки применятся в течение 5 минут.
          </p>
        </div>

        <div className="check">
          <label className="check__label" htmlFor="login-remember">
            <input
              id="login-remember"
              className="check__input"
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
            />
            <span>Запомнить в этом браузере</span>
          </label>
        </div>

        <button type="submit" className="button button--primary button--block" disabled={pending}>
          {pending ? 'Проверка…' : 'Подключиться'}
        </button>

        <p className="login__note">
          Данные хранятся только в localStorage вашего браузера и отправляются напрямую в
          GREEN-API.
        </p>
      </form>
    </div>
  );
}
