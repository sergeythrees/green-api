import '@testing-library/jest-dom/vitest';

// jsdom does not implement matchMedia, which `@telegram-apps/telegram-ui` needs
// for its `prefers-color-scheme` detection. Provide the minimal MediaQueryList
// surface the kit touches.
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
