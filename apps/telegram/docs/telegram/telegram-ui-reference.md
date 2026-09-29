# @telegram-apps/telegram-ui v2.1.13 reference

Mechanical extraction from the published typings in
`.cache/tgui-probe/package/dist/` (`dist/index.d.ts` + per-component `.d.ts`).
This documents the API **exactly as shipped in 2.1.13** — where a name you may
expect does not exist (e.g. `Input`'s `onValueChange`, `Cell`'s `title`), that is
called out explicitly instead of being invented.

## Setup

```jsx
import '@telegram-apps/telegram-ui/dist/styles.css';
import { AppRoot, Button, Cell, Input } from '@telegram-apps/telegram-ui';
```

| Fact | Value |
| --- | --- |
| Package name / version | `@telegram-apps/telegram-ui` `2.1.13` |
| Root import | `@telegram-apps/telegram-ui` → `dist/index.js` (ESM), `dist/cjs/index.js` (CJS) |
| Types entry | `dist/index.d.ts` (re-exports `./components`) — TS types are bundled |
| Stylesheet (required) | `@telegram-apps/telegram-ui/dist/styles.css` (~46 KB, import **once**, globally) |
| React peer deps | `react@^18.2.0`, `react-dom@^18.2.0` (exact peer range; React 18 only) |
| Node engine | `>=18.0.0` |
| `exports` field | **none** → deep subpath imports are allowed (this is how icons are imported) |
| CSS modules | built in; class names are hashed (`tgui-<hash>`), no theming API through them |
| Side effects | `dist/index.js` / `dist/cjs/index.js` (the CSS import in the bundle entry) |

Notes that change how you build:

- `AppRoot` is not optional. The **light theme defaults are declared on AppRoot's own root
  class** (`.tgui-6a12827a138e8827`); without an `AppRoot` ancestor the `--tgui--*` variables
  are undefined and components render unstyled. `Appearance = dark` only swaps a second class.
- Telegram theme colours are read from `--tg-theme-*` CSS custom properties (supplied by the
  Telegram WebApp SDK) with hard-coded light/dark fallbacks, e.g.
  `--tgui--bg_color: var(--tg-theme-bg-color, #fff)`.
- Not present in 2.1.13 (do not import): `Body`, `H1`–`H5`, `Label`, `Hint`, `Code`
  (typography is `Text` / `Title` / `Headline` / `Subheadline` / `Caption` / `LargeTitle`),
  `Input` `onValueChange` / `mode` / `size` / `appearance` / `rightAddons`,
  `Button` `appearance`, `Cell` `title` / `avatar` / `extra`, `Avatar` `name` / `mode`,
  `IconButton` `icon`, `Modal.Root` / `useModal`, `AppRoot` `themeParams` / `lang`.
- `Touch` (`Service/Touch`) and `HorizontalScroll` (`Service/HorizontalScroll`) exist as source
  files but are **not exported** by any barrel — they cannot be imported from the package root
  in 2.1.13. `Tappable` and `VisuallyHidden` are exported.

Full public export surface of the root (65 value exports):

```
Accordion, AppRoot, Avatar, AvatarStack, Badge, Banner, Blockquote, Breadcrumbs, Button,
ButtonCell, Caption, Card, Cell, Checkbox, Chip, CircularProgress, ColorInput,
CompactPagination, Divider, FileInput, FixedLayout, Headline, IconButton, IconContainer,
Image, Info, InlineButtons, Input, LargeTitle, Link, List, Modal, Multiselect,
Multiselectable, Navigation, Pagination, PinInput, Placeholder, Popper, Progress, Radio,
Rating, RootRenderer, Section, SegmentedControl, Select, Selectable, Skeleton, Slider,
Snackbar, Spinner, Spoiler, Steps, Subheadline, Switch, Tabbar, TabsList, Tappable, Text,
Textarea, Timeline, Title, Tooltip, Typography, VisuallyHidden
```

Each export also has a matching `XxxProps` type export (e.g. `ButtonProps`, `CellProps`).

## Theme variables

All theming goes through CSS custom properties. 77 are defined in `dist/styles.css`;
the semantic set below is defined on the AppRoot root class (light) and overridden by the
dark class when `appearance="dark"` (or the OS prefers dark and `appearance` is omitted).

Core surfaces / Telegram theme bridge (value shown = light default, dark in parentheses):

| Variable | Light default | Dark default |
| --- | --- | --- |
| `--tgui--bg_color` | `var(--tg-theme-bg-color, #fff)` | `#212121` |
| `--tgui--text_color` | `var(--tg-theme-text-color, #000)` | `#fff` |
| `--tgui--hint_color` | `var(--tg-theme-hint-color, #707579)` | `#aaa` |
| `--tgui--link_color` | `var(--tg-theme-link-color, #007aff)` | `#2990ff` |
| `--tgui--button_color` | `var(--tg-theme-button-color, #007aff)` | `#2990ff` |
| `--tgui--button_text_color` | `var(--tg-theme-button-text-color, #fff)` | `#fff` |
| `--tgui--secondary_bg_color` | `var(--tg-theme-secondary-bg-color, #efeff4)` | `#0f0f0f` |
| `--tgui--header_bg_color` | `var(--tg-theme-header-bg-color, #fff)` | `#212121` |
| `--tgui--accent_text_color` | `var(--tg-theme-accent-text-color, #007aff)` | `#007aff` |
| `--tgui--section_bg_color` | `#fff` | `#212121` |
| `--tgui--section_header_text_color` | `#707579` | `#aaa` |
| `--tgui--subtitle_text_color` | `#707579` | `#aaa` |
| `--tgui--destructive_text_color` | `#e53935` | `#e53935` |
| `--tgui--divider` | `rgba(0,0,0,.15)` | `hsla(0,0%,100%,.05)` |
| `--tgui--outline` | `rgba(0,0,0,.05)` | `hsla(0,0%,100%,.1)` |
| `--tgui--skeleton` | `hsla(0,0%,100%,.03)` | `hsla(0,0%,100%,.03)` |
| `--tgui--surface_primary` | `hsla(0,0%,100%,.95)` | `hsla(0,0%,9%,.95)` |
| `--tgui--surface_dark` | `rgba(56,56,56,.85)` | — |
| `--tgui--tertiary_bg_color` | `#f4f4f7` | `#2a2a2a` |
| `--tgui--quartenary_bg_color` | `#f6f6fa` | `#2f2f2f` |
| `--tgui--segmented_control_active_bg` | `#fff` | `#2f2f2f` |
| `--tgui--card_bg_color` | `#fff` | `#242424` |
| `--tgui--secondary_hint_color` | `#a2acb0` | `#78797e` |
| `--tgui--secondary_fill` | `rgba(67,120,255,.1)` | `rgba(41,144,255,.15)` |
| `--tgui--green` | `#31d158` | `#32e55e` |
| `--tgui--destructive_background` | `#e53935` | `rgba(255,35,35,.02)` |
| `--tgui--primary_code_highlight` | `#4378ff` | `#2990ff` |
| `--tgui--secondary_code_highlight` | `#b00fb4` | `#e937ed` |
| `--tgui--tertiary_code_highlight` | `#3a9f20` | `#5ae536` |
| `--tgui--plain_background` | `rgba(0,0,0,.04)` | `hsla(0,0%,100%,.08)` |
| `--tgui--plain_foreground` | `rgba(0,0,0,.8)` | `hsla(0,0%,100%,.95)` |
| `--tgui--toast_accent_color` | `#55a6ff` | — |
| `--tooltip_background_dark` | `rgba(0,0,0,.85)` | — |
| `--tgui--white` / `--tgui--black` | `#fff` / `#000` | — |

Typography scale (identical in both appearances):

`--tgui--font-family`, `--tgui--font_weight--accent1` (`700`), `--tgui--font_weight--accent2` (`600`),
`--tgui--font_weight--accent3` (`400`), `--tgui--large_title--font_size` (`34px`),
`--tgui--large_title--line_height` (`42px`), `--tgui--title1--font_size` (`28px`),
`--tgui--title1--line_height` (`36px`), `--tgui--title2--font_size` (`24px`),
`--tgui--title2--line_height` (`32px`), `--tgui--title3--font_size` (`20px`),
`--tgui--title3--line_height` (`24px`), `--tgui--headline--font_size` (`19px`),
`--tgui--headline--line_height` (`28px`), `--tgui--text--font_size` (`17px`),
`--tgui--text--line_height` (`26px`), `--tgui--subheadline1--font_size` (`16px`),
`--tgui--subheadline1--line_height` (`24px`), `--tgui--subheadline2--font_size` (`15px`),
`--tgui--subheadline2--line_height` (`22px`), `--tgui--caption1--font_size` (`13px`),
`--tgui--caption1--line_height` (`20px`), `--tgui--caption2--font_size` (`11px`),
`--tgui--caption2--line_height` (`16px`).

Layout / component-level knobs:

`--tgui--border--width` (`1px`, `.5px` on iOS), `--tgui--base--section--box_shadow`,
`--tgui--cell--middle--padding` (`16px 0` desktop / `12px 0` iOS-ish),
`--tgui--button--hovered-opacity` (`.15` / `.07` / `.03` / `.5` per mode),
`--tgui--button--spinner-color`, `--tgui--multiselect--gap`, `--tgui--multiselect--min-height`,
`--tgui--pin_input--buttons-gap` (`12px`), `--tgui--pin_input--button-width` (`33.3%` / `76px`),
`--tgui--slider--thumb--size` (`12px` / `24px`), `--tgui--timeline--item--size` (`12px` / `16px`),
`--tgui--timeline--item--thickness` (`4px`), `--tgui--compact_pagination--dot--background--selected`,
`--tgui--compact_pagination--dot--opacity--selected`, `--tgui--safe_area_inset_bottom`,
`--tgui--z-index--simple` (`1`), `--tgui--z-index--skeleton` (`2`), `--tgui--z-index--overlay` (`3`).

Override example: `:root { --tgui--button_color: #ff0000; }` (or scope it on a wrapper inside `AppRoot`).

## AppRoot

`import { AppRoot } from '@telegram-apps/telegram-ui';`

Renders a `<div>` (the app shell) that supplies platform/appearance/portal context and carries the
theme-variable classes. Forwarded ref → `HTMLDivElement`. All standard `HTMLAttributes<HTMLDivElement>`
props pass through.

| Prop | Type | Required | Notes |
| --- | --- | --- | --- |
| `platform` | `'base' \| 'ios'` | optional | Auto-detected from Telegram/user agent when omitted (`usePlatform`) |
| `appearance` | `'light' \| 'dark'` | optional | Auto-detected from the Telegram theme / OS `prefers-color-scheme` when omitted; `'dark'` adds the dark theme class |
| `portalContainer` | `RefObject<HTMLDivElement>` | optional | Overrides the portal target used by `Modal`, `Popper`, `Snackbar`, `PinInput`; defaults to **AppRoot's own div** |
| `children` | `ReactNode` | optional | App content |
| `className` | `string` | optional | Merged with AppRoot's own classes (also from `HTMLAttributes`) |
| `style` | `CSSProperties` | optional | Pass-through |

Context (`AppRootContext`, value shape): `{ platform?: 'base' | 'ios'; appearance?: 'light' | 'dark';
portalContainer?: RefObject<HTMLDivElement>; isRendered: boolean }`. The type is
`AppRootContextInterface`; the hooks `useAppearance`, `usePlatform`, `usePortalContainer` and the
generic `useAppRootContext` are **internal** (`dist/hooks`, `dist/components/Service/AppRoot/hooks`) —
not re-exported from the package root. `AppRoot` has **no** `themeParams`, `lang`, `inset` or
`onThemeChange` prop in 2.1.13; theme colours come from `--tg-theme-*` CSS variables.

```jsx
<AppRoot appearance="dark" platform="ios">…</AppRoot>
```

## RootRenderer

`import { RootRenderer } from '@telegram-apps/telegram-ui';`

Renders its children into the AppRoot portal container (`createPortal`) and returns `null` when the
portal is not ready. Used internally by `Popper`, `Snackbar`, `PinInput` — you rarely need it directly.

| Prop | Type | Required | Notes |
| --- | --- | --- | --- |
| `children` | `ReactNode` | optional | Content portalled to `AppRoot` (`portalContainer`) |

## Tappable

`import { Tappable } from '@telegram-apps/telegram-ui';`

Generic interactive container that adds touch/click feedback (ripple or opacity). It is the base of
`Cell`, `IconButton`, `ButtonCell`, `InlineButtons.Item`, etc. Ref → `unknown`.

| Prop | Type | Required | Notes |
| --- | --- | --- | --- |
| `Component` | `ElementType` | optional | Rendered tag/component; defaults to `div` |
| `interactiveAnimation` | `'opacity' \| 'background'` | optional | Feedback style |
| …all others | `AllHTMLAttributes<HTMLElement>` | optional | Standard HTML attributes |

## Touch

`Touch` — **not exported** from the package root in 2.1.13 (`dist/components/Service/Touch/Touch.d.ts`
exists, no barrel re-export). Kept internal. Its props (if the source is vendored) extend
`AllHTMLAttributes<HTMLElement>` with `usePointerHover?`, `useCapture?`, `slideThreshold?: number`,
`noSlideClick?`, `stopPropagation?`, `Component?`, and gesture handlers
`onStart/onStartX/onStartY/onMove/onMoveX/onMoveY/onEnd/onEndX/onEndY?: TouchEventHandler`,
`onEnter?/onLeave?: (e: MouseEvent) => void`. Prefer `Tappable` in application code.

## VisuallyHidden

`import { VisuallyHidden } from '@telegram-apps/telegram-ui';`

Renders a span whose content is hidden visually but exposed to screen readers (a11y helpers).
Ref → `HTMLSpanElement`.

| Prop | Type | Required | Notes |
| --- | --- | --- | --- |
| `Component` | `ElementType` | optional | Root tag; defaults to `span` |
| …all others | `AllHTMLAttributes<T>` | optional | Standard HTML attributes |

## HorizontalScroll

`HorizontalScroll` — **not exported** from the package root in 2.1.13
(`dist/components/Service/HorizontalScroll/HorizontalScroll.d.ts` exists, no barrel re-export).
Declaration: `HorizontalScrollProps extends AllHTMLAttributes<HTMLElement>` with a single extra
`Component?: ElementType`; renders a horizontally scrollable flex row.

## Typography

`import { Typography, Text, Title, Headline, Subheadline, Caption, LargeTitle } from '@telegram-apps/telegram-ui';`

All typography components share `TypographyProps` and render an `AllHTMLAttributes<HTMLElement>` element
(rest props pass through).

| Prop | Type | Required | Notes |
| --- | --- | --- | --- |
| `weight` | `'1' \| '2' \| '3'` | optional | Font-weight accent (`700` / `600` / `400`) |
| `caps` | `boolean` | optional | Uppercase transform |
| `plain` | `boolean` | optional | Remove default typography styles (not on `Text`/`Caption`) |
| `Component` | `ElementType` | optional | Override the rendered tag |
| `children`, `className`, `style`, … | `AllHTMLAttributes<HTMLElement>` | optional | Standard HTML attributes |

Exact export names and their variants (there is no `Body`/`H1`–`H5`/`Label`/`Hint`/`Code`):

| Export | Props type | Extra prop | Renders |
| --- | --- | --- | --- |
| `Typography` | `TypographyProps` | — | Base styled element (no preset size) |
| `Text` | `TextProps = Omit<TypographyProps, 'plain'>` | — | Body text, 17 px/26 px (`--tgui--text--*`) |
| `Title` | `TitleProps extends TypographyProps` | `level?: '1' \| '2' \| '3'` (default `'2'`) | Heading; level 1→`<h2>`, 2→`<h3>`, 3→`<h4>`; sizes 28/24/20 px |
| `Headline` | `HeadlineProps = TypographyProps` | — | 19 px/28 px headline |
| `Subheadline` | `SubheadlineProps extends TypographyProps` | `level?: '1' \| '2'` (default `'1'`) | 16 px or 15 px subheadline |
| `Caption` | `CaptionProps extends Omit<TypographyProps, 'plain'>` | `level?: '1' \| '2'` (default `'1'`) | 13 px or 11 px caption |
| `LargeTitle` | `LargeTitleProps = TypographyProps` | — | 34 px/42 px large title |

```jsx
<LargeTitle>Chats</LargeTitle>
<Title level="3">Pinned</Title>
<Caption level="2">last seen recently</Caption>
```

## Button

`import { Button } from '@telegram-apps/telegram-ui';`

Renders a `<button>` (or `Component`) with Telegram-style modes, sizes, optional `before`/`after`
slots and a loading spinner. Ref → `unknown`. Extends
`Omit<AllHTMLAttributes<HTMLButtonElement>, 'size'>` — so `onClick`, `type`, `disabled`,
`className`, `style`, `children`, `title`, etc. pass through.

| Prop | Type | Required | Notes |
| --- | --- | --- | --- |
| `size` | `'s' \| 'm' \| 'l'` | optional | Default `'m'` |
| `mode` | `'filled' \| 'bezeled' \| 'plain' \| 'gray' \| 'outline' \| 'white'` | optional | Default `'filled'`; this is the visual "appearance" — there is **no** `appearance` prop |
| `stretched` | `boolean` | optional | Stretch to container width |
| `before` | `ReactNode` | optional | Slot before the label (icon) |
| `after` | `ReactNode` | optional | Slot after the label (badge/counter) |
| `loading` | `boolean` | optional | Shows a spinner instead of the content |
| `disabled` | `boolean` | optional | Disables interaction (also HTML `disabled`) |
| `Component` | `ElementType` | optional | Default `'button'`; e.g. `'a'` or a router `Link` |
| `children` | `ReactNode` | optional | Button label |

```jsx
<Button mode="filled" size="m" stretched onClick={send}>Send</Button>
```

## IconButton

`import { IconButton } from '@telegram-apps/telegram-ui';`

Renders a square, tappable icon button (`Tappable` with `Component="button"`). Ref → `HTMLButtonElement`.
Extends `ButtonHTMLAttributes<HTMLButtonElement>`.

| Prop | Type | Required | Notes |
| --- | --- | --- | --- |
| `size` | `'s' \| 'm' \| 'l'` | optional | Default `'m'`; recommended icon sizes: 20 px for `s`, 24 px for `m`, 28 px for `l` |
| `mode` | `'bezeled' \| 'plain' \| 'gray' \| 'outline'` | optional | Default `'bezeled'` |
| `children` | `ReactNode` | optional | **The icon goes in `children`** — there is no `icon` prop in 2.1.13 |
| `onClick`, `disabled`, `className`, `aria-label`, … | `ButtonHTMLAttributes<HTMLButtonElement>` | optional | Pass-through |

```jsx
<IconButton size="m" mode="plain" aria-label="Attach"><Icon24Attach /></IconButton>
```

## IconContainer

`import { IconContainer } from '@telegram-apps/telegram-ui';`

Renders a `<div>` that frames/crops a single icon (fixed square box, centred).
Extends `HTMLAttributes<HTMLDivElement>`; no component-specific props.

| Prop | Type | Required | Notes |
| --- | --- | --- | --- |
| `children` | `ReactNode` | optional | The icon to frame (e.g. a 28 px icon) |
| `className`, `style`, … | `HTMLAttributes<HTMLDivElement>` | optional | Pass-through |

## Avatar

`import { Avatar } from '@telegram-apps/telegram-ui';`

Extends `ImageProps`, so it renders the `Image` component with avatar styling (circle/rounded),
plus an acronym fallback and a static `Avatar.Badge`. It has **no** `name` or `mode` prop.

| Prop | Type | Required | Notes |
| --- | --- | --- | --- |
| `src` | `string` | optional | Image URL (from `ImgHTMLAttributes`) |
| `size` | `20 \| 24 \| 28 \| 40 \| 48 \| 96` | optional | Default `40`; pixel size |
| `acronym` | `string` | optional | One or two letters shown as a placeholder; when set, `fallbackIcon` is not used |
| `fallbackIcon` | `ReactNode` | optional | Shown when `src` is absent or fails to load |
| `alt` | `string` | optional | Standard img attribute |
| `children` | `ReactNode` | optional | Content inside the wrapper (e.g. `<Avatar.Badge type="dot" />`) |
| `onLoad` / `onError` | handlers | optional | Standard img handlers |

`Avatar.Badge` = `AvatarBadge extends BadgeProps` (`type: 'number' | 'dot'`, `mode?`, `large?`).
Related: `AvatarStack` — `AvatarStackProps extends HTMLAttributes<HTMLDivElement>` with
`children: ReactElement<AvatarProps>[]` (required); renders overlapping avatars.

```jsx
<Avatar size={48} src={photoUrl} acronym="AB" />
```

## Badge

`import { Badge } from '@telegram-apps/telegram-ui';`

Renders a `<span>` used as a numeric counter or a dot indicator (also reachable as `Avatar.Badge`,
`Image.Badge`). Extends `HTMLAttributes<HTMLSpanElement>`.

| Prop | Type | Required | Notes |
| --- | --- | --- | --- |
| `type` | `'number' \| 'dot'` | **required** | Number = shows children, dot = plain dot |
| `mode` | `'primary' \| 'critical' \| 'secondary' \| 'gray' \| 'white'` | optional | Colour scheme |
| `large` | `boolean` | optional | Larger size; only for `type="number"` |
| `children` | `ReactNode` | optional | The count text for `type="number"` |

## Cell

`import { Cell } from '@telegram-apps/telegram-ui';`

Interactive list row built on `Tappable` (renders a `div` by default). Ref → `unknown`.
Extends `Omit<TappableProps, 'Component'>` → all `AllHTMLAttributes<HTMLElement>` pass through.
**There is no `title`, `avatar`, `extra` or `subtitle`-vs-`description` alias: the main label is
`children`, the left slot is `before`, the right slot is `after`.**

| Prop | Type | Required | Notes |
| --- | --- | --- | --- |
| `children` | `ReactNode` | optional | Main content / header line (this is the "title") |
| `subtitle` | `ReactNode` | optional | Line below the main content |
| `description` | `ReactNode` | optional | Additional text below the subtitle |
| `subhead` | `ReactNode` | optional | Content above the main content |
| `hint` | `ReactNode` | optional | Content next to the header (e.g. timestamp) |
| `titleBadge` | `ReactElement<BadgeProps>` | optional | Badge next to the header |
| `before` | `ReactNode` | optional | Left slot (usually an `Avatar` or `IconContainer`) |
| `after` | `ReactNode` | optional | Right slot (chevron, switch, value text) |
| `Component` | `ElementType` | optional | Root tag; `div` by default |
| `hovered` | `boolean` | optional | Force hover state (keyboard navigation) |
| `multiline` | `boolean` | optional | Allow multi-line content without truncation |
| `interactiveAnimation` | `'opacity' \| 'background'` | optional | From `Tappable` |
| `onClick`, `className`, … | `AllHTMLAttributes<HTMLElement>` | optional | Pass-through |

Related exports:

| Export | Props | Notes |
| --- | --- | --- |
| `ButtonCell` | `ButtonCellProps extends Omit<TappableProps, 'Component'>` with `mode?: 'default' \| 'destructive'`, `before?`, `after?`, `Component?`, `children?` | Cell-shaped button row for destructive/actions |
| `Info` | `InfoProps extends HTMLAttributes<HTMLDivElement>` with `type: 'text' \| 'avatarStack'` (**required**), `subtitle?: string`, `avatarStack?: ReactElement<AvatarStackProps>` | Cell header block with subtitle or avatar stack |
| `Navigation` | `NavigationProps = HTMLAttributes<HTMLDivElement>` | Right-hand chevron/value container for a Cell |

```jsx
<Cell before={<Avatar size={40} src={u.photo} acronym={u.initials} />}
      subtitle="last seen recently" after={<Icon24ChevronRight />}>
  {u.name}
</Cell>
```

## Card

`import { Card } from '@telegram-apps/telegram-ui';`

Renders a rounded content surface (`<div>`) with plain/ambient variants; exposes
`Card.Cell` and `Card.Chip`. Ref → `HTMLDivElement`. Extends `HTMLAttributes<HTMLElement>`.

| Prop | Type | Required | Notes |
| --- | --- | --- | --- |
| `type` | `'plain' \| 'ambient'` | optional | Default `'plain'` (from `CardContextInterface['type']`); ambient adds the filled/ambient background |
| `children`, `className`, `style`, `onClick`, … | `HTMLAttributes<HTMLElement>` | optional | Pass-through |

| Sub-component | Props | Notes |
| --- | --- | --- |
| `Card.Cell` | `CardCellProps extends CellProps` | `Cell` restyled for use inside a Card |
| `Card.Chip` | `CardChipProps extends ChipProps` | `Chip` restyled for use inside a Card |

## Section

`import { Section } from '@telegram-apps/telegram-ui';`

Renders a grouped section (`<section>`) with an optional header and footer; exposes
`Section.Header` and `Section.Footer`. Extends `HTMLAttributes<HTMLElement>`.

| Prop | Type | Required | Notes |
| --- | --- | --- | --- |
| `header` | `ReactNode` | optional | Header rendered above the children |
| `footer` | `ReactNode` | optional | Footer rendered below the children |
| `children` | `ReactNode` | optional | Typically a `List` of `Cell`s |
| `className`, … | `HTMLAttributes<HTMLElement>` | optional | Pass-through |

| Sub-component | Props | Notes |
| --- | --- | --- |
| `Section.Header` | `SectionHeaderProps extends HTMLAttributes<HTMLHeadElement>` with `large?: boolean` | Section title; `large` = large-title style |
| `Section.Footer` | `SectionFooterProps extends HTMLAttributes<HTMLElement>` with `centered?: boolean` | Small hint text under the section |

## List

`import { List } from '@telegram-apps/telegram-ui';`

Renders a `<div>` that stacks cells with the section background/dividers; wraps `Cell` children
(usually inside a `Section`). Extends `HTMLAttributes<HTMLDivElement>`.

| Prop | Type | Required | Notes |
| --- | --- | --- | --- |
| `Component` | `ElementType` | optional | Root tag; defaults to `div` (e.g. `'ul'`) |
| `children`, `className`, … | `HTMLAttributes<HTMLDivElement>` | optional | Pass-through |

## Placeholder

`import { Placeholder } from '@telegram-apps/telegram-ui';`

Renders a centred empty-state block: illustration (`children`) + `header` + `description` + `action`.
Extends `HTMLAttributes<HTMLElement>`.

| Prop | Type | Required | Notes |
| --- | --- | --- | --- |
| `children` | `ReactNode` | optional | Illustration / sticker / icon |
| `header` | `ReactNode` | optional | Title |
| `description` | `ReactNode` | optional | Explanatory text |
| `action` | `ReactNode` | optional | Action area (usually a `Button`) |

## Banner

`import { Banner } from '@telegram-apps/telegram-ui';`

Renders a prominent informational/CTA panel with optional background, close icon and action children.
Extends `HTMLAttributes<HTMLDivElement>`.

| Prop | Type | Required | Notes |
| --- | --- | --- | --- |
| `type` | `'section' \| 'inline'` | optional | Layout variant |
| `before` | `ReactNode` | optional | Left icon/image |
| `callout` | `ReactNode` | optional | Small text above the header |
| `header` | `ReactNode` | optional | Main title |
| `subheader` | `ReactNode` | optional | Secondary line |
| `description` | `ReactNode` | optional | Detail text under the subheader |
| `background` | `ReactNode` | optional | Full-bleed background (image/gradient) |
| `onCloseIcon` | `MouseEventHandler<HTMLButtonElement>` | optional | Renders the close button when provided |
| `children` | `ReactNode` | optional | Action content (buttons); wrap multiple in a fragment |

## Blockquote

`import { Blockquote } from '@telegram-apps/telegram-ui';`

Renders a `<div>` quote block with an optional top-right icon; `type="text"` wraps content in
typography. Extends `HTMLAttributes<HTMLDivElement>`.

| Prop | Type | Required | Notes |
| --- | --- | --- | --- |
| `type` | `'text' \| 'other'` | optional | `text` applies text typography to children |
| `topRightIcon` | `ReactNode` | optional | Defaults to a quote icon (`Icon12Quote`) |
| `children` | `ReactNode` | optional | Quoted content |

## Accordion

`import { Accordion } from '@telegram-apps/telegram-ui';`

Container for an expandable item; state is **controlled** and shared via context with
`Accordion.Summary` / `Accordion.Content`. Renders a `<div>`-based structure (`Accordion.Summary`
is a `Cell`).

| Prop | Type | Required | Notes |
| --- | --- | --- | --- |
| `expanded` | `boolean` | **required** | Current open state |
| `onChange` | `(expanded: boolean) => void` | **required** | Toggle callback |
| `children` | `ReactNode` | **required** | `Accordion.Summary` + `Accordion.Content` |
| `id` | `string` | optional | a11y id linking summary and content (auto-generated if omitted) |

| Sub-component | Props | Notes |
| --- | --- | --- |
| `Accordion.Summary` | `AccordionSummaryProps extends CellProps` | Header row (plus internal `onClick`, `after` = chevron) |
| `Accordion.Content` | `AccordionContentProps extends HTMLAttributes<HTMLDivElement>` | Collapsible body |

```jsx
<Accordion expanded={open} onChange={setOpen}>
  <Accordion.Summary>Details</Accordion.Summary>
  <Accordion.Content>…</Accordion.Content>
</Accordion>
```

## Input

`import { Input } from '@telegram-apps/telegram-ui';`

Renders a labelled input row: `FormInput` wrapper (header / before / after / status) plus an
`<input>` whose typography follows the platform. Ref → `HTMLInputElement`.
Props = `FormPublicProps & InputHTMLAttributes<HTMLInputElement>`.

| Prop | Type | Required | Notes |
| --- | --- | --- | --- |
| `value` | `string \| number \| readonly string[]` | optional | Standard React controlled input value |
| `onChange` | `ChangeEventHandler<HTMLInputElement>` | optional | **The callback is `onChange`** — 2.1.13 has no `onValueChange` |
| `defaultValue` | `string \| number \| readonly string[]` | optional | Uncontrolled initial value |
| `placeholder` | `string` | optional | Standard input placeholder |
| `type` | `string` | optional | Defaults to `'text'` |
| `header` | `ReactNode` | optional | Label rendered above the field (`FormPublicProps`) |
| `before` | `ReactNode` | optional | Slot before the input (icon) |
| `after` | `ReactNode` | optional | Slot after the input (icon/action) — the closest thing to `rightAddons` |
| `status` | `'default' \| 'error' \| 'focused'` | optional | Validation/visual state |
| `disabled` | `boolean` | optional | Disables the input |
| `inputMode`, `maxLength`, `name`, `onBlur`, `onFocus`, `onKeyDown`, `autoFocus`, `readOnly`, … | `InputHTMLAttributes<HTMLInputElement>` | optional | All standard input attributes pass through |
| `className`, `style` | — | optional | Applied to the FormInput wrapper |

There is **no** `mode`, `size`, `appearance` or `rightAddons` prop on `Input` in 2.1.13 (those belong
to the v3 API). Use `before`/`after` for addons.

```jsx
<Input header="Message" placeholder="Write a message…" value={text} onChange={e => setText(e.target.value)} />
```

Related form exports:

| Export | Props | Notes |
| --- | --- | --- |
| `Textarea` | `Omit<FormPublicProps, 'after' \| 'before'> & TextareaHTMLAttributes<HTMLTextAreaElement>` | Multi-line variant of the same row; ref → `HTMLTextAreaElement` |
| `Select` | `Omit<FormPublicProps, 'after'> & SelectHTMLAttributes<HTMLSelectElement>` with `children: ReactNode` (**required**) | Native `<select>` in a form row |
| `ColorInput` | `Omit<FormPublicProps, 'after'> & InputHTMLAttributes<HTMLInputElement>` | Colour picker row |
| `FileInput` | `InputHTMLAttributes<HTMLInputElement>` + `label?: string` | File picker row; ref → `HTMLDivElement` |
| `Multiselect` | `Omit<InputHTMLAttributes<HTMLInputElement>, 'value' \| 'defaultValue' \| 'onChange'> & Omit<FormPublicProps,'after'> & Pick<…>` with `options: MultiselectOption[]` (**required**) | Tag/chip multi-select; adds `value`, `onChange`, `filterFn`, `onInputChange`, `inputValue`, `selectedBehavior`, `emptyText`, `creatable`, `closeDropdownAfterSelect`, `renderOption`, `renderChip` |
| `Multiselectable` | `InputHTMLAttributes<HTMLInputElement>` | Multi-select-capable control |
| `Selectable` | `InputHTMLAttributes<HTMLInputElement>` | iOS-style selectable control |
| `PinInput` | `Omit<HTMLAttributes<HTMLElement>, 'onChange'>` + `label?`, `pinCount?`, `value?: number[]`, `onChange?: (v: number[]) => void`, `onBiometricAuth?`, `biometricType?` | PIN/OTP entry cells |
| `Slider` | `SliderProps = SliderNoMultipleProps \| SliderMultipleProps` | Range slider; base has `min?`, `max?`, `step?`, `disabled?`, `before?`, `after?`, `getAriaLabel?`, `getAriaValueText?`; single: `multiple?: false`, `value?: number`, `onChange?: (value, event) => void`; multiple: `multiple: true`, `value?: [number, number]` |
| `Rating` | `Omit<HTMLAttributes<HTMLLabelElement>, 'onChange'>` + `precision?: 0.1\|0.2\|0.25\|0.5\|1`, `max?`, `value?`, `onChange?: (value: number) => void`, `IconContainer?: ElementType<Icon>` | Star rating control |

## Checkbox

`import { Checkbox } from '@telegram-apps/telegram-ui';`

Renders a styled checkbox `<input type="checkbox">` with iOS/base artwork. Ref → `HTMLInputElement`.
Props = `InputHTMLAttributes<HTMLInputElement>`.

| Prop | Type | Required | Notes |
| --- | --- | --- | --- |
| `checked` | `boolean` | optional | Controlled state |
| `defaultChecked` | `boolean` | optional | Uncontrolled initial state |
| `onChange` | `ChangeEventHandler<HTMLInputElement>` | optional | Change callback |
| `indeterminate` | `boolean` | optional | Tri-state visual |
| `disabled` | `boolean` | optional | Disable interaction |
| `children` | `ReactNode` | optional | Label content (from input attributes) |

## Radio

`import { Radio } from '@telegram-apps/telegram-ui';`

Renders a styled radio `<input type="radio">`. Ref → `HTMLInputElement`.
Props = `InputHTMLAttributes<HTMLInputElement>` (`checked`, `defaultChecked`, `name`, `value`,
`onChange`, `disabled`, `children` as the label, …). No extra props.

## Switch

`import { Switch } from '@telegram-apps/telegram-ui';`

Renders a styled toggle `<input type="checkbox">` (iOS-style switch). Ref → `HTMLInputElement`.
Props = `InputHTMLAttributes<HTMLInputElement>` (`checked`, `defaultChecked`, `onChange`, `disabled`, …).
No extra props.

## Modal

`import { Modal } from '@telegram-apps/telegram-ui';`

Renders a bottom-sheet/dialog on top of a vaul `Drawer`, portalled into **AppRoot's
`portalContainer`** (falls back to document body if there is no AppRoot). Ref → `HTMLDivElement`.
Extends `Omit<HTMLAttributes<HTMLDivElement>, 'onAnimationEnd'>`.

| Prop | Type | Required | Notes |
| --- | --- | --- | --- |
| `open` | `boolean` | optional | Controlled visibility |
| `onOpenChange` | `(open: boolean) => void` | optional | Fired on open/close; use with `open` |
| `trigger` | `ReactNode` | optional | Element that opens the modal (uncontrolled usage) |
| `header` | `ReactNode` | optional | Header content (rendered as `Modal.Header`) |
| `overlayComponent` | `ReactNode` | optional | Custom overlay; defaults to `<Modal.Overlay />` |
| `nested` | `boolean` | optional | Render as a nested drawer inside another Modal |
| `closeThreshold` | `number` | optional | Swipe distance (0–1) that closes the modal |
| `scrollLockTimeout` | `number` | optional | Debounce before swipe-to-close after scrolling |
| `modal` | `boolean` | optional | Block interaction with the background |
| `preventScrollRestoration` | `boolean` | optional | Do not restore scroll position on close |
| `snapPoints` | `(number \| string)[]` | optional | Snap heights (px or `%` of screen) |
| `fadeFromIndex` | `never` | optional | Declared but typed `never` (not usable) |
| `dismissible` | `boolean` | optional | Allow closing by user interaction |
| `children` | `ReactNode` | optional | Modal body |

Sub-components: `Modal.Header` (`ModalHeaderProps extends HTMLAttributes<HTMLElement>` with
`before?`, `after?`), `Modal.Close` (`ModalCloseProps { children?: ReactNode }` — closes the modal),
`Modal.Overlay` (`ModalOverlayProps { className?: string }`).

**Opening/closing in 2.1.13:** there is no `Modal.Root`, no `useModal` hook and no
`RootRenderer` requirement. Either pass `trigger`, or control it with `open` + `onOpenChange`.
`RootRenderer` is only used internally by `Popper`, `Snackbar` and `PinInput`.

```jsx
const [open, setOpen] = useState(false);
<Modal open={open} onOpenChange={setOpen} header={<Modal.Header>Title</Modal.Header>}>…</Modal>
```

## Popper

`import { Popper } from '@telegram-apps/telegram-ui';`

Renders a floating element positioned relative to `targetRef` using `@floating-ui/react-dom`,
through `RootRenderer` (i.e. inside AppRoot's portal container). Ref → `unknown`.
Extends `Omit<UseFloatingMiddlewaresOptions, 'arrowHeight' | 'arrowPadding' | 'arrowRef'>` and
`HTMLAttributes<HTMLDivElement>`.

| Prop | Type | Required | Notes |
| --- | --- | --- | --- |
| `targetRef` | `RefObject<HTMLElement> \| VirtualElement` | **required** | Anchor element for positioning |
| `placement` | `PlacementWithAuto` = `'auto' \| 'auto-start' \| 'auto-end'` \| floating-ui `Placement` (`'top'`, `'bottom-start'`, …) | optional | Preferred placement |
| `offsetByMainAxis` | `number` | optional | Offset along the main axis |
| `offsetByCrossAxis` | `number` | optional | Offset along the cross axis |
| `withArrow` | `boolean` | optional | Render the arrow |
| `arrowProps` | `FloatingArrowProps & { height?: number; padding?: number }` | optional | Arrow config (`offset?`, `isStaticOffset?`, `coords?`, `placement?`, `Icon?`) |
| `ArrowIcon` | `FloatingArrowProps['Icon']` | optional | Custom arrow icon component |
| `sameWidth` | `boolean` | optional | Match the target's width |
| `customMiddlewares` | `Middleware[]` | optional | Extra floating-ui middlewares |
| `autoUpdateOnTargetResize` | `boolean` | optional | Reposition on target resize |
| `Component` | `ElementType` | optional | Root tag |
| `children`, `className`, … | `HTMLAttributes<HTMLDivElement>` | optional | Pass-through |

## Tooltip

`import { Tooltip } from '@telegram-apps/telegram-ui';`

`Popper` with tooltip styling; all `Popper` props apply.

| Prop | Type | Required | Notes |
| --- | --- | --- | --- |
| `mode` | `'light' \| 'dark'` | optional | Tooltip colour scheme |
| `targetRef` | `RefObject<HTMLElement> \| VirtualElement` | **required** | Inherited from `PopperProps` |
| `children` | `ReactNode` | optional | Tooltip content |
| … | `PopperProps` | optional | All other Popper/middleware props |

## Chip

`import { Chip } from '@telegram-apps/telegram-ui';`

Renders a `<div>`-based pill/tag with optional before/after slots (also used as `Card.Chip`).
Extends `AllHTMLAttributes<HTMLDivElement>`.

| Prop | Type | Required | Notes |
| --- | --- | --- | --- |
| `mode` | `'elevated' \| 'mono' \| 'outline'` | optional | Visual variant |
| `before` | `ReactNode` | optional | Leading icon/avatar |
| `after` | `ReactNode` | optional | Trailing icon |
| `children` | `ReactNode` | optional | Chip label |
| `Component` | `ElementType` | optional | Root tag |

## Progress

`import { Progress } from '@telegram-apps/telegram-ui';`

Renders a linear progress bar (a div whose fill width is derived from `value`).
Extends `HTMLAttributes<HTMLDivElement>`.

| Prop | Type | Required | Notes |
| --- | --- | --- | --- |
| `value` | `number` | optional | Progress value |
| `className`, `style`, … | `HTMLAttributes<HTMLDivElement>` | optional | Pass-through |

Also available: `CircularProgress` — `CircularProgressProps extends HTMLAttributes<HTMLOrSVGElement>`
with `size?: 'small' \| 'medium' \| 'large'`, `progress?: number` (renders an SVG ring, `null` when
progress is not renderable).

## Link

`import { Link } from '@telegram-apps/telegram-ui';`

Renders a styled `<a>` (Telegram link colour). Props =
`AnchorHTMLAttributes<HTMLAnchorElement>` (`href`, `target`, `rel`, `onClick`, `children`, …).
No extra props.

## Image

`import { Image } from '@telegram-apps/telegram-ui';`

Renders `<img>` with rounded corners and an optional `fallbackIcon` when `src` is missing/fails;
supports `Image.Badge` children. Extends `ImgHTMLAttributes<HTMLElement>`.

| Prop | Type | Required | Notes |
| --- | --- | --- | --- |
| `src` | `string` | optional | Image URL |
| `size` | `20 \| 24 \| 28 \| 40 \| 48 \| 96` | optional | Default `40`; pixel size and border radius |
| `fallbackIcon` | `ReactNode` | optional | Rendered when there is no `src` or loading fails |
| `children` | `ReactNode` | optional | Overlay content (e.g. `<Image.Badge type="dot" />`) |
| `alt`, `crossOrigin`, `loading`, `onLoad`, `onError`, … | `ImgHTMLAttributes<HTMLElement>` | optional | Pass-through |

`Image.Badge` = `ImageBadge extends BadgeProps` (`type` required) and returns `null` when it cannot render.

## Icons

Icons are **not** re-exported from the package root. Import each icon by its size folder and
snake_case file name; the export name is `Icon{Size}{PascalCaseName}`:

```js
import { Icon24Chat } from '@telegram-apps/telegram-ui/dist/icons/24/chat';
import { Icon28AddCircle } from '@telegram-apps/telegram-ui/dist/icons/28/add_circle';
```

Path convention: `@telegram-apps/telegram-ui/dist/icons/<size>/<snake_case_name>`, where `<size>` is
one of `12, 16, 20, 24, 28, 32, 36`. There is no per-directory `index`, so each icon is a separate
deep import. Every icon is an SVG React component typed
`Icon extends SVGProps<SVGSVGElement> { title?: string }` — so `className`, `style`, `width`,
`height`, `color`/`fill`, `onClick` and `title` all work.

Complete set (36 icons):

| Dir | Import names (`dist/icons/<dir>/<file>`) → export |
| --- | --- |
| 12 | `quote` → `Icon12Quote` |
| 16 | `cancel` → `Icon16Cancel`; `chevron` → `Icon16Chevron` |
| 20 | `chevron_down` → `Icon20ChevronDown`; `copy` → `Icon20Copy`; `question_mark` → `Icon20QuestionMark`; `select` → `Icon20Select`; `select_ios` → `Icon20SelectIOS` |
| 24 | `cancel` → `Icon24Cancel`; `channel` → `Icon24Channel`; `chat` → `Icon24Chat`; `chevron_down` → `Icon24ChevronDown`; `chevron_left` → `Icon24ChevronLeft`; `chevron_right` → `Icon24ChevronRight`; `close` → `Icon24Close`; `notifications` → `Icon24Notifications`; `person_remove` → `Icon24PersonRemove`; `qr` → `Icon24QR`; `sun_low` → `Icon24SunLow` |
| 28 | `add_circle` → `Icon28AddCircle`; `archive` → `Icon28Archive`; `attach` → `Icon28Attach`; `chat` → `Icon28Chat`; `close_ambient` → `Icon28CloseAmbient`; `close` → `Icon28Close`; `devices` → `Icon28Devices`; `edit` → `Icon28Edit`; `heart` → `Icon28Heart`; `stats` → `Icon28Stats` |
| 32 | `profile_colored_square` → `Icon32ProfileColoredSquare` |
| 36 | `backspace` → `Icon36Backspace`; `face_id` → `Icon36FaceId`; `fingerprint` → `Icon36FingerPrint`; `scan_face` → `Icon36ScanFace` |

Note the exact capitalisation: `Icon20SelectIOS`, `Icon24QR`, `Icon36FingerPrint`.

## Other exported components (props summary)

| Export | Props type | Key props |
| --- | --- | --- |
| `AvatarStack` | `AvatarStackProps extends HTMLAttributes<HTMLDivElement>` | `children: ReactElement<AvatarProps>[]` (required) |
| `Breadcrumbs` | `BreadcrumbsProps extends HTMLAttributes<HTMLDivElement>` | `divider?: 'dot' \| 'chevron' \| 'slash'`, `children?`; `.Item` |
| `CompactPagination` | `Omit<HTMLAttributes<HTMLDivElement>, 'onChange'>` | `mode?: 'default' \| 'ambient' \| 'white'`, `children?: ReactElement<CompactPaginationItemProps>[]`; `.Item` (`selected?`) |
| `Divider` | `HTMLAttributes<HTMLHRElement>` | none (renders `<hr>`) |
| `FixedLayout` | `AllHTMLAttributes<HTMLElement>` | `Component?: ElementType`, `vertical?: 'top' \| 'bottom'` |
| `InlineButtons` | `HTMLAttributes<HTMLDivElement>` | `mode?`, `children: ReactElement<InlineButtonsItemProps>[]` (required); `.Item` = `InlineButtonsItemProps extends ButtonHTMLAttributes<HTMLButtonElement>` with `text?`, `mode?`, `children?` |
| `Pagination` | `UsePaginationProps & Omit<HTMLAttributes<HTMLDivElement>, 'onChange'>` | `count`, `page`, `defaultPage`, `siblingCount`, `boundaryCount`, `hidePrevButton`, `hideNextButton`, `onChange`, `disabled?` |
| `SegmentedControl` | `HTMLAttributes<HTMLDivElement>` | `children: ReactElement<SegmentedControlItemProps>[]` (required); `.Item` (`selected?`) |
| `Skeleton` | `HTMLAttributes<HTMLDivElement>` | `withoutAnimation?: boolean`, `visible?: boolean` |
| `Snackbar` | `HTMLAttributes<HTMLDivElement>` | `before?`, `after?`, `description?`, `link?: ReactElement<LinkProps>`, `duration?: number`, `onClose: () => void` (required), `children?`; `.Button` |
| `Spinner` | `HTMLAttributes<HTMLDivElement>` | `size: 's' \| 'm' \| 'l'` (required) |
| `Spoiler` | `HTMLAttributes<HTMLDivElement>` | `visible?: boolean` |
| `Steps` | `HTMLAttributes<HTMLDivElement>` | `count: number`, `progress: number` (both required) |
| `Tabbar` | `HTMLAttributes<HTMLDivElement>` | `children: ReactElement<TabbarItemProps>[]` (required); `.Item` with `selected?`, `text?`, `children?` |
| `TabsList` | `HTMLAttributes<HTMLDivElement>` | `children: ReactElement<TabsItemProps>[]` (required); `.Item` (`selected?`) |
| `Timeline` | `HTMLAttributes<HTMLUListElement>` | `horizontal?`, `active?: number`, `children: ReactElement<TimelineItemProps>[]` (required); `.Item` with `mode?: 'active' \| 'pre-active'`, `horizontal?`, `header?: string`, `children?` |
