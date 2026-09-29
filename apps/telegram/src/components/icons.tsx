import type { JSX, SVGProps } from 'react';

/**
 * Telegram icon set.
 *
 * `@telegram-apps/telegram-ui` 2.1.13 ships only 36 platform icons (chevrons,
 * close, chat, attach, add_circle, …) and has nothing for sending a message,
 * searching, signing out or revealing a token, so the messenger layer carries
 * its own set. The shapes follow Telegram Web K: a 24×24 grid,
 * `stroke-width: 2`, round caps and joins, and `currentColor` so an icon
 * inherits the colour of the control around it (which is what lets the
 * composition's send button paint its plane white).
 */
type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'>;

function Icon({ children, ...props }: IconProps & { children: React.ReactNode }): JSX.Element {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

/** Magnifier for the sidebar search field. */
export function IconSearch(props: IconProps): JSX.Element {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </Icon>
  );
}

/** Sign-out arrow for the sidebar header. */
export function IconLogout(props: IconProps): JSX.Element {
  return (
    <Icon {...props}>
      <path d="M14.5 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8" />
      <path d="M10 12h9.5" />
      <path d="m16.5 8.5 3.5 3.5-3.5 3.5" />
    </Icon>
  );
}

/** Eye, for revealing `apiTokenInstance` on the login screen. */
export function IconEye(props: IconProps): JSX.Element {
  return (
    <Icon {...props}>
      <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  );
}

/** Eye with a strike-through, for hiding the token again. */
export function IconEyeOff(props: IconProps): JSX.Element {
  return (
    <Icon {...props}>
      <path d="M9.9 5.2A9.6 9.6 0 0 1 12 5c6 0 9.5 6.2 9.5 6.2a17 17 0 0 1-2.8 3.6" />
      <path d="M6.4 7.1A16.8 16.8 0 0 0 2.5 11.2S6 17.4 12 17.4a9.3 9.3 0 0 0 3.6-.7" />
      <path d="m10 10a2.9 2.9 0 0 0 4 4" />
      <path d="m4 4 16 16" />
    </Icon>
  );
}

/** Warning triangle used by the error banners. */
export function IconWarning(props: IconProps): JSX.Element {
  return (
    <Icon {...props}>
      <path d="M12 4.5 21 19.5H3L12 4.5Z" />
      <path d="M12 10v4" />
      <path d="M12 16.8h.01" />
    </Icon>
  );
}

/**
 * Telegram brand mark: a solid circle with the paper plane knocked out in white.
 *
 * Unlike the stroked glyphs above this is a filled mark, so it cannot reuse the
 * shared `Icon` wrapper: the circle takes `currentColor` (the caller paints it
 * with the accent token) while the plane stays white, exactly like the app icon.
 */
export function IconTelegramLogo(props: IconProps): JSX.Element {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <circle cx="12" cy="12" r="11" fill="currentColor" />
      <path
        d="M17.3 7.1 6.5 11.3c-.6.2-.6.8 0 1l2.6.8.9 2.9c.1.4.5.5.8.2l1.4-1.3 2.6 1.9c.4.3.8.1.9-.4l1.4-8.7c.1-.4-.2-.7-.5-.6Z"
        fill="#fff"
      />
    </svg>
  );
}

/*
 * Read-receipt ticks.
 *
 * They use their own tiny viewBoxes rather than the 24×24 grid, because Telegram
 * packs them tightly against the 12px bubble timestamp. `IconTickTwoAccent` is a
 * separate export even though its geometry repeats `IconTickTwo`: the delivery
 * state is a semantic choice made by the bubble, and naming the read receipt
 * keeps that decision out of a CSS-only colour switch on a shared glyph.
 */
export function IconTickOne(props: IconProps): JSX.Element {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M1.5 6.5 4.5 9.5 10.5 2.5" />
    </svg>
  );
}

export function IconTickTwo(props: IconProps): JSX.Element {
  return (
    <svg
      width="18"
      height="12"
      viewBox="0 0 18 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M1 6.5 4 9.5 9.5 3" />
      <path d="M7.5 6.5 10.5 9.5 16 3" />
    </svg>
  );
}

/** The "read" receipt: same double check, kept as its own named export. */
export function IconTickTwoAccent(props: IconProps): JSX.Element {
  return <IconTickTwo {...props} />;
}

/** Red exclamation marker of a failed send; the caller sets `color` to danger. */
export function IconTickError(props: IconProps): JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <circle cx="8" cy="8" r="7" fill="currentColor" />
      <path
        d="M8 4.2v4.4"
        stroke="#fff"
        strokeWidth="1.7"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M8 11.4h.01"
        stroke="#fff"
        strokeWidth="1.7"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/** Three horizontal lines: the main menu, as in the top-left of Telegram Web. */
export function IconMenu(props: IconProps): JSX.Element {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path
        d="M3 6.5h18M3 12h18M3 17.5h18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/** Three vertical dots: the per-chat context menu of Telegram Web. */
export function IconMore(props: IconProps): JSX.Element {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <g fill="currentColor">
        <circle cx="5" cy="12" r="1.9" />
        <circle cx="12" cy="12" r="1.9" />
        <circle cx="19" cy="12" r="1.9" />
      </g>
    </svg>
  );
}

/** Smiling face: the emoji button Telegram puts inside the message field. */
export function IconEmoji(props: IconProps): JSX.Element {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="1.9"
        fill="none"
      />
      <path
        d="M8.2 13.6c.7 1.5 2.1 2.4 3.8 2.4s3.1-.9 3.8-2.4"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        fill="none"
      />
      <g fill="currentColor">
        <circle cx="9" cy="10" r="1.1" />
        <circle cx="15" cy="10" r="1.1" />
      </g>
    </svg>
  );
}

