import type { JSX } from 'react';

export default function Splash(): JSX.Element {
  return (
    <div className="splash">
      <div className="logo-mark logo-mark--xl" aria-hidden="true" />
      <div className="splash__spinner" aria-hidden="true" />
      <p className="splash__text">Подключение…</p>
    </div>
  );
}
