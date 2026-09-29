import { afterEach, describe, expect, it } from 'vitest';
import { clearCredentials, loadCredentials, saveCredentials } from './credentials';
import { DEFAULT_API_URL } from '../api/greenApi';

const STORAGE_KEY = 'green-api-telegram-chat:credentials';

const credentials = {
  apiUrl: 'https://4100.api.green-api.com',
  idInstance: '4100000000',
  apiTokenInstance: 'token',
};

afterEach(() => {
  window.localStorage.clear();
});

describe('credentials storage', () => {
  it('round-trips credentials through localStorage', () => {
    saveCredentials(credentials);
    expect(loadCredentials()).toEqual(credentials);
  });

  it('stores the credentials under the Telegram-specific key', () => {
    saveCredentials(credentials);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(credentials));
  });

  it('returns null when nothing is stored', () => {
    expect(loadCredentials()).toBeNull();
  });

  it('ignores malformed JSON', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not json');
    expect(loadCredentials()).toBeNull();
  });

  it('ignores a payload with missing fields', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ apiUrl: 'https://example.com' }));
    expect(loadCredentials()).toBeNull();
  });

  it('falls back to the default apiUrl when it is blank', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ apiUrl: '   ', idInstance: '1', apiTokenInstance: 't' }),
    );
    expect(loadCredentials()?.apiUrl).toBe(DEFAULT_API_URL);
  });

  it('clears stored credentials', () => {
    saveCredentials(credentials);
    clearCredentials();
    expect(loadCredentials()).toBeNull();
  });
});
