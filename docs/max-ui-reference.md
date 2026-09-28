# MAX web client — UI reference

Reference for recreating the chat screen of the MAX web client (`https://web.max.ru/`).

**How this was researched.** `web.max.ru` is a SvelteKit SPA that boots to a QR-login
screen, so the authenticated desktop chat screen itself cannot be fetched anonymously.
However, the client ships a public, unauthenticated **design-token stylesheet** and the
official **web app manifest**, and those were downloaded and parsed directly. That is the
strongest evidence in this document. Review articles and screenshots were used as
secondary confirmation.

**Evidence legend**

| Tag | Meaning |
| --- | --- |
| **CONFIRMED** | Read out of an official MAX artifact (webmanifest, shipped CSS/JS) or plainly visible in a published screenshot/article. |
| **INFERRED** | Reasonable reconstruction for parts not directly observable (the authenticated desktop layout). |
| **UNCONFIRMED** | No source found; a sensible fallback is given. |

Primary sources:

- `https://web.max.ru/s/site.webmanifest` — official web app manifest (**CONFIRMED**).
- `https://web.max.ru/_app/immutable/assets/0.BY8rEfvM.css` — the shipped design-token
  stylesheet, ~731 KB (**CONFIRMED**). All `--token` values below come from here.
- `https://web.max.ru/` boot HTML + `_app/immutable/entry/app.DNxAeMV9.js` (**CONFIRMED**).
- Screenshots in [appleinsider.ru — 5 отличий веб-версии МАКС от приложения](https://appleinsider.ru/obzory-prilozhenij/5-otlichij-veb-versii-messendzhera-maks-ot-prilozheniya.html)
  (**CONFIRMED**, mobile-web build).
- [ivankornev.com — обзор интерфейса чата в MAX](https://ivankornev.com/ru/articles/messengers-social/settings/kak-vyglyadit-chat-v-max-gde-nayti-funkcii/) — zone description (**CONFIRMED**).
- [pnp.ru — о фирменном стиле MAX](https://www.pnp.ru/social/v-max-obyasnili-vybor-nazvaniya-dlya-messendzhera-i-osobennosti-firmennogo-stilya.html) — brand palette description (**CONFIRMED**).

---

## 1. Overall layout

**CONFIRMED**

- The client is a **two-pane desktop layout**: conversation list on the left, open chat on
  the right. The MAX screenshotter Chrome extension declares
  `host_permissions: ["https://web.max.ru/*"]` and expects DOM classes `message`,
  `msg-content`, `bubble--`, `message--` on that origin, i.e. a real two-pane web chat.
- Left sidebar width is a hard token in the shipped CSS:

  ```css
  .sidebar, .sidebarContainer { width: 420px; }
  @media screen and (max-width: 1280px) { .sidebar, .sidebarContainer { width: 360px; } }
  ```

  At ≤1280 px the sidebar becomes an **overlay drawer** (`position:absolute; top:0; right:0;
  z-index: var(--z-index-layer-popover)`) instead of a column. So: **420 px normal, 360 px
  below 1280 px viewport width.**
- The sidebar background is `var(--background-surface)`; the right pane sits on
  `var(--background-primary)`.
- The chat pane is a CSS grid in three rows:

  ```css
  .layout { flex:1; grid-template:"top" 76px  "main" 1fr  "bottom" 80px / 1fr; display:grid; }
  ```

  → **header ≈ 76 px tall, writebar/input row ≈ 80 px tall, message list takes the rest.**
- The message input ("writebar") is a **floating rounded composer pinned to the bottom of
  the right pane**, not a full-bleed bar. Shipped rules:

  ```css
  .composer { margin: 0 var(--spacing-xl) var(--spacing-xl);   /* 0 24px 24px */
              background: var(--float-primary-flat);
              border-radius: var(--size-16);
              box-shadow: 0 4px 16px 0 var(--shadow-elevation-3-primary),
                          0 0 2px 0 var(--shadow-elevation-3-secondary); }
  ```

**INFERRED** — layout sketch (see ASCII diagram in the reply). Panel order left→right:
narrow icon rail is *absent*; the client is just `[chat list 420px][chat pane 1fr]`.
On narrow desktop (≤1280 px) the list collapses into a slide-over drawer over the chat.

**UNCONFIRMED** — exact behavior of a possible third column (contact info / right drawer).
Fallback: treat it as an on-demand overlay drawer, not a permanent column.

---

## 2. Color palette

### Brand accent

**CONFIRMED**

- `web.max.ru/s/site.webmanifest`:

  ```json
  { "name": "MAX Web", "background_color": "#ffffff", "theme_color": "#0066cc",
    "display": "standalone", "lang": "ru" }
  ```

  → **official brand/PWA accent: `#0066cc`**. Light background: `#ffffff`.
- pnp.ru quotes MAX CEO Farit Khusnoyarov: the logo is a **speech bubble on a
  blue-violet background**, chosen because ~90 % of comms/IT services use green, blue and
  violet. **CONFIRMED** as a description; the exact app-icon gradient hexes are not in that text.
- App-icon gradient, sampled pixel-by-pixel from the official
  `https://web.max.ru/favicon.png?v=2026` (**CONFIRMED**, measured):
  top-left blue `#3c90fe` → centre `#4048eb` → bottom-right violet `#8c45de`.
  Use `linear-gradient(135deg, #3c90fe 0%, #8c45de 100%)` for logo/onboarding marks.

### Semantic tokens (light and dark)

**CONFIRMED** — from `:root:where([data-color-theme=simple][data-color-scheme=…])`.
MAX ships **10 themes** (`simple`, `space`, `aquamarine`, `feb23`, `mar8`, `moscow`,
`nature`, `neon`, `lebedev`, `tadam`) × **light/dark**, switched via
`[data-color-theme]` + `[data-color-scheme]` attributes. `simple` = the neutral default.

| Token | Light (`simple`) | Dark (`simple`) |
| --- | --- | --- |
| `--background-surface` (sidebar) | `#edeef2` | `#0f0f12` |
| `--background-primary` (chat pane) | `#ffffff` | `#17181c` |
| `--background-secondary` (cards) | `#f5f7fa` | `#25262d` |
| `--background-card` | `#ffffff` | `#25262d` |
| `--background-tertiary` | `#0909090d` | `#ffffff17` |
| `--text-primary` | `#060708` | `#ffffff` |
| `--text-secondary` | `#060708ad` | `#ffffffad` |
| `--text-tertiary` | `#06070885` | `#ffffff85` |
| `--text-mute` | `#06070866` | `#ffffff5c` |
| `--icon-primary` | `#060708d6` | `#ffffff` |
| `--icon-secondary` | `#060708a3` | `#ffffffad` |
| `--divider-primary` | `#0c0d0e29` | — |
| `--divider-secondary` | `#0c0d0e0f` | — |
| `--text-themed` / `--icon-themed` / `--stroke-themed` (accent) | `#007aff` | `#007aff` |
| `--counter-attention` (unread badge) | `#ff303c` | `#ff303c` |
| `--icon-positive` | `#1abe43` | `#1abe43` |
| `--icon-negative` | `#ff303c` | `#ff303c` |
| `--float-primary-flat` (composer surface) | `#ffffff` | (theme-derived) |
| `--writebar-input-flat` | `#ffffff` | `#1e1f24` |
| `--writebar-input-text` | `#0c0d0e` | `#e7e7e7` |
| `--input-background` | `#09090914` | `#ffffff17` |

> Note the two-level system: the **PWA/brand** accent is `#0066cc`, while the **in-app UI
> accent token** (`--text-themed`, `--icon-themed`, focus rings, active tab) is `#007aff`.
> Both are CONFIRMED, from different official artifacts.

### Message bubbles — own vs. other

**CONFIRMED** — bubbles are themed by `[data-bubbles-variant=incoming|outgoing]`.
Default `simple` theme:

| | Light | Dark |
| --- | --- | --- |
| **Outgoing (own)** `--bubbles-background-bubble` | `#0070eb` | `#2258cc` |
| **Incoming (other)** `--bubbles-background-bubble` | `#f2f2f2` | `#202022` |
| Outgoing body text `--bubbles-text-body` | `#ffffff` | `#ffffff` |
| Outgoing secondary text `--bubbles-text-time` | `#ffffffa3` | `#ffffffa3` |
| Outgoing read ticks `--bubbles-icon-read-status` | `#ffffffe0` | `#ffffffe0` |
| Incoming body text `--bubbles-text-body` | `#060708` (text-primary) | `#ffffff` |
| Incoming time `--bubbles-text-time` | `#06070885` | `#ffffffa3` |
| Incoming action/link `--bubbles-text-action` | `#007aff` | `#ffffff` |

The `space` theme (the violet/blue brand look) uses `#6965e5` outgoing on dark and
`#e9fdff` outgoing on light, with a `#8849b4 → #735acd → #5d6ae5` outgoing gradient.
The `simple` theme also defines an outgoing gradient
`--bubbles-background-bubble-gradient-step-1..3` = `#17a8e5 → #0b8ce8 → #0070eb`
(light) / `#4429cc → #2251e5 → #0088cc` (dark) — used for the "old" / gradient bubble
style. **CONFIRMED.**

**Per-author colors (group chats).** Incoming messages from different participants are
coloured per author via `[data-author-color="0".."4"]`. The avatar palette tokens are
**CONFIRMED** (`--avatar-*-step-1/step-2`, plus `--avatar-*-text` for the name colour),
e.g. `lilac #9b90fe→#6746ec`, `dark-sky #79bcff→#4289ed`, `orchid #fa82ba→#e74aa6`,
`malachite #1bd6e3→#27a5c8`, `tangerine #ffb381→…`. In screenshots the sender name above
the bubble is rendered in that author colour (green / blue / violet in the sample).

---

## 3. Message bubbles

**CONFIRMED** (tokens) + **INFERRED** (final geometry)

- **Corner radius.** `--border-radius-local-bubble-regular: var(--border-radius-common-l)`
  = `--size-16` → **16 px** for a standalone bubble. Stacked/grouped bubbles use
  `--border-radius-local-bubble-stack-corner: var(--border-radius-common-s-half)` =
  `--size-6` → **6 px** on the "inner" corners of a consecutive run. Capsule elements use
  `--border-radius-local-capsule: 10 px`; the composer is `16 px`.
- **No tail.** The token set has a *regular* and a *stack-corner* radius but **no tail
  path/clip token** for message bubbles, and published screenshots show plain rounded
  rectangles with no pointed tail. → draw **tail-less** bubbles.
- **Padding.** `--spacing-local-padding-base-padding-vertical: var(--spacing-m)` = **12 px**
  vertical; `--spacing-local-padding-base-padding-horizontal: var(--spacing-l)` = **16 px**
  horizontal. A left offset token for outgoing stacks exists:
  `--spacing-local-p2g-stacked-outgoing-left: 54px` (**CONFIRMED** — this is the content
  gutter left of outgoing bubbles, i.e. avatar + indent).
- **Max width.** No explicit bubble `max-width` token was found; the closest confirmed
  value is the generic modal/content cap `max-width: 80%` and the text-column
  `max-width: min(240px, 100% - 132px)`. **UNCONFIRMED for bubbles** — fallback:
  `max-width: 75%` of the message-pane width, capped at **~440 px** (that number appears as
  a real MAX content cap) and **min-width ~80 px**.
- **Timestamp placement.** **CONFIRMED**: inside the bubble, bottom-right, on the same
  baseline as the last text line (`float`-style inline placement, as clearly visible in the
  screenshots). Label typography token: `--font-bubble-label-size: 12px`
  (scales 12/14/16/18/19/20 px by text scale) with `--font-bubble-label-line-height: 16px`
  and `letter-spacing: .2px`. A `.time`/`.time--right` class pair exists with
  `text-align:right` and `padding-right: var(--spacing-m)` (**CONFIRMED**).
- **Read-status ticks.** **CONFIRMED**: outgoing bubbles carry a double-check mark to the
  right of the timestamp, tinted `--bubbles-icon-read-status`.
  Icon names present in the client: `icon_message_check`, `icon_message_unread`,
  `icon_status_read`, plus a feature flag `max-readmarks` (**CONFIRMED**, from bundle).
  In screenshots: single/double outlined check, accent-blue when read.
- **Date separators.** The client has `unreadSeparator--first` and a `"Сегодня"`-style
  centred date chip is visible in screenshots (small muted label, no bubble).
- Media messages (single photo) get a bubble with the same 16 px radius and the timestamp
  overlaid on the image bottom-right (**screenshot-confirmed**).
- Reaction pills sit just below the bubble (`--border-radius-local-reaction: 10px`,
  `--bubbles-background-reaction-*` tokens — **CONFIRMED**). In the screenshot a
  `❤️ 3` pill overlaps the bubble's bottom edge.

---

## 4. Typography

**CONFIRMED**

- Font stack, straight from `:root` in the shipped CSS:

  ```css
  --font: -apple-system, BlinkMacSystemFont, "Roboto", system-ui,
          Avenir, Helvetica, Arial, sans-serif;
  ```

  → **no custom MAX typeface on web**; it is the system UI font with Roboto as the first
  named fallback. Body weight `400`, default `line-height: 1.5`.
- Type scale tokens exist in named families; the relevant ones:

  | Token family | Size(s) | Weight | Line height | Letter-spacing |
  | --- | --- | --- | --- | --- |
  | `--font-body-*` (message text, list previews) | 13 / 14 / 15 / 16 / 18 / 19 / 20 / 21 / 24 px | 400 | 16 / 20 / 24 / 28 px | 0 or .15px |
  | `--font-body-strong-*` (names, emphasis) | same | 500 | same | 0 or .15px |
  | `--font-bubble-label-*` (timestamp, ticks label) | 12 (→14/16/18/19/20) px | 400 | 16 px | .2px |
  | `--font-bubble-label-strong-*` | 12 px | 500 | 16 px | .2px |
  | `--font-bubble-tag-*` (chips/tags) | 11–16 px | 400 | 14–20 px | .2–.3px |
  | `--font-bubble-note-strong-*` (small notes) | 10–18 px | 500 | 12–20 px | .3px |
  | `--font-bubble-description-*` | 13–22 px | 400 | 16–26 px | 0 or .15px |
  | `--font-action-*` (buttons) | 13 / 14 / 17 px | 500 | 16 / 20 px | .15px |
  | `--font-subheader-*` (list header) | — | 600 | — | — |

  The scale is driven by a text-size setting (`data-scale` ∈
  `small…xsmall/medium/xlarge/xxlarge/xxxlarge`, and `ax1…ax5`), which is why most families
  list 5–8 sizes. **Default/medium values to use:** message text **15 px / 20 px**, sender
  name **15 px / 20 px weight 500**, bubble label **12 px / 16 px**, chat-list name
  **15–16 px weight 500**, preview **13–14 px / 20 px**, sidebar header **17 px weight 600**.

**INFERRED** — the default/medium row above is a reconstruction; the tokens confirm the
*set* of allowed values, not which one is the `medium` default.

---

## 5. Left sidebar (chat list)

**CONFIRMED**

- Width **420 px** (`360 px` below 1280 px viewport), background
  `var(--background-surface)` (`#edeef2` light / `#0f0f12` dark), right border
  `1px solid var(--divider-secondary)` (`#0c0d0e0f`).
- Search field: a `.search` block with `padding: 0 var(--spacing-l)` (16 px) and
  `margin-bottom: var(--spacing-l)`; a new-layout variant uses
  `padding: 0 var(--spacing-xl)` (24 px). It is a **rounded filled input**, placeholder
  "Поиск"/"Контакты", using `--input-background` (`#09090914` light / `#ffffff17` dark).
- Chat-list cells use `--border-radius-local-cell-chat: var(--border-radius-common-l)`
  = **16 px**, so each row is a rounded rect with hover/selected fill
  (`var(--background-tertiary)`), not a full-bleed stripe.
- Header above the list renders in `600 var(--font-subheader-size) var(--font)`.
- Bundle identifiers confirm the structure: `avatarChat`, `chat-list`, `chatList`,
  `unreadSeparator--first`, `max-favorite-chats` (**CONFIRMED**).
- Unread badge colour: `--counter-attention: #ff303c` with `--counter-contrast: #fff`
  text (**CONFIRMED**). A muted variant `--counter-mute: #0606081f` exists for the
  "pinned"/muted pill.

**INFERRED** — per-row anatomy, top→bottom order of the sidebar:

```
┌─ Sidebar (420 / 360 px, bg --background-surface) ──────────────┐
│  Header row: "Чаты" (17px/600)        [+ compose icon]         │  ~56 px
│  Search input (rounded 12–16px, bg --input-background,         │
│               leading magnifier, placeholder "Поиск")          │  ~48 px
│  Filter chips row (Все / Непрочитанные / …)                    │  optional
│  ─────────────────────────────────────────────────────────────  │
│  ▢ Avatar 48–52px    Имя собеседника           14:32     ②     │
│    (circle, brand  Последнее сообщение "…"   (preview, 1 line, │
│     gradient or    muted --text-secondary, ellipsis)           │
│     initials)                                     [red badge]  │
│  … more rows, 16px rounded, ~72 px tall, 8–12px gaps …         │
└────────────────────────────────────────────────────────────────┘
```

Per item: **avatar** (circle, left, ~48–52 px) · **name** (weight 500,
`--text-primary`, ellipsised) · **last-message preview** (regular, `--text-secondary`,
single line ellipsised) · **time** (top-right, `--font-bubble-label` 12 px,
`--text-tertiary`) · **unread badge** (bottom-right, pill, `--counter-attention` bg,
white text, min 18–20 px). Verified-messenger/bot accounts show a small badge next to the
name. Muted chats show a grey badge (`--counter-mute`).

**UNCONFIRMED** — exact avatar pixel size for list rows (no dedicated `--size-*` token
found; only `--avatar-size: 64px` for profile/call views). Fallback: **48 px** avatar,
**72 px** row height, **12 px** vertical gap, **12–16 px** horizontal padding.

---

## 6. Chat header

**CONFIRMED**

- Height fixed by the chat grid: **76 px** (`grid-template: "top" 76px …`). The `<=1280 px`
  variant of the generic header rule uses `min-height: 80px` and
  `padding: var(--spacing-xl) var(--spacing-l)` (24 / 16 px), sticky at top.
- Contents, confirmed from the mobile-web screenshot and the sidebar/mobile sidebar
  markup (`.top` with three cells — first/last `flex:none`, middle `flex:auto; min-width:0`):
  - **Back / menu button** (leftmost) — `←` back chevron on mobile, `☰` hamburger in the
    narrow web build; on wide desktop this collapses to the pane's own navigation.
  - **Avatar** — circle, ~40 px in the header; group chats show a composite/initial avatar.
  - **Name** — chat title, `--font-body-strong` weight 500, `--text-primary`, ellipsised.
  - **Subtitle / status** — one line under the name: `--text-secondary`, 13–14 px. Values
    seen: `6 участников`, `был(а) недавно`, `в сети`, `Сообщения для себя`,
    `Красноярск, 19:00` for a channel. For groups MAX shows **member count**;
    for 1:1 shows **online / last-seen**.
  - **Action icons** (right side, ~24 px, `--icon-primary`): **search** (magnifier),
    **overflow menu** (⋮ / three dots) — both visible in the web screenshot. The client also
    ships call affordances: the mobile screenshot shows **video** and **phone** icons before
    the overflow menu, and the articles describe call buttons top-right. The shipped
    `.main`/`.hover` header icon rules confirm **24 × 24 px** icon buttons with a hover
    opacity transition. Bundle strings confirm `search`, call and menu actions.
- Header background: `var(--background-surface)` with a `1px solid transparent` bottom
  border (the generic header rule); the chat pane can also fade a scroll edge
  (`--aside-before`/`--aside-after` gradient fades, `--fade-height`) under the header.

**INFERRED** — desktop chat header sketch:

```
┌──────────────────────────────────────────────────────────────────────────┐
│ (☰)  ◯ avatar 40   Имя чата                              🔍    📹  📞   ⋮ │ 76 px
│                    был(а) недавно / 6 участников                         │
└──────────────────────────────────────────────────────────────────────────┘
```

**UNCONFIRMED** — exact 40 px header-avatar size and whether video/phone icons appear in
the **web** header on wide viewports (they are visible in the mobile-web screenshot;
articles say the web build lacks browser-based calling). Fallback: render only
**search + overflow** on web, at 24 px, and keep the avatar at **40 px**.

---

## 7. Writebar (message input) — supporting detail

**CONFIRMED**

- Floating rounded composer: `border-radius: 16px`, outer margin `0 24px 24px`, surface
  `var(--float-primary-flat)`, elevation shadow `0 4px 16px 0 #00000014, 0 0 2px 0 #00000014`.
- Input inner radius `--border-radius-local-writebar-input: 12px`.
- Input colours: `--writebar-input-flat` `#ffffff` / `#1e1f24`,
  `--writebar-input-text` `#0c0d0e` / `#e7e7e7`, `--writebar-divider` `#0c0d0e0f`.
- Button set on web (screenshot + article: *"слева скрепка для файлов, справа смайлик и
  синяя стрелка отправки"* — **CONFIRMED**): **paperclip (attach)** on the left,
  placeholder **"Сообщение"**, then **emoji** and a **circular accent send button**
  (blue, white up-arrow). The mobile app additionally has mic and round-video buttons;
  the web build does **not** (article-confirmed).
- Emoji picker area surface: `--writebar-emoji-area` `#f6f6f6` / `#181818`.

---

## 8. Concrete clone spec (single source of truth)

Use this table directly when building.

| Property | Light | Dark |
| --- | --- | --- |
| App / PWA accent (`theme_color`) | `#0066cc` | `#0066cc` |
| In-app UI accent (`--text-themed`) | `#007aff` | `#007aff` |
| Brand icon gradient | `linear-gradient(135deg, #3c90fe, #8c45de)` | same |
| Pane background (`--background-primary`) | `#ffffff` | `#17181c` |
| Sidebar background (`--background-surface`) | `#edeef2` | `#0f0f12` |
| Sidebar divider | `#0c0d0e0f` | `#ffffff17` |
| Primary text | `#060708` | `#ffffff` |
| Secondary text | `#060708ad` | `#ffffffad` |
| Tertiary text / time | `#06070885` | `#ffffff85` |
| Own bubble | `#0070eb` | `#2258cc` |
| Own bubble text | `#ffffff` | `#ffffff` |
| Own bubble time / ticks | `#ffffffa3` / `#ffffffe0` | `#ffffffa3` / `#ffffffe0` |
| Other bubble | `#f2f2f2` | `#202022` |
| Other bubble text | `#060708` | `#ffffff` |
| Unread badge | `#ff303c` bg, `#ffffff` text | same |
| Composer surface | `#ffffff` | `#1e1f24` |
| Composer placeholder | `#0c0d0e` (at ~55 % alpha) | `#e7e7e7` |

| Geometry | Value | Confidence |
| --- | --- | --- |
| Sidebar width | 420 px (≤1280 px → 360 px) | CONFIRMED |
| Header height | 76 px | CONFIRMED |
| Writebar row height | 80 px | CONFIRMED |
| Writebar outer margin | 0 24px 24px | CONFIRMED |
| Bubble radius (single) | 16 px | CONFIRMED |
| Bubble radius (stack inner corner) | 6 px | CONFIRMED |
| Bubble padding | 12 px / 16 px | CONFIRMED |
| Bubble max-width | ~75 %, cap ~440 px | UNCONFIRMED |
| Bubble tail | none | INFERRED |
| Timestamp | inside bubble, bottom-right, 12/16 px, ls .2px | CONFIRMED |
| Read ticks | double check, right of timestamp, `#ffffffe0` | CONFIRMED |
| Font stack | `-apple-system, BlinkMacSystemFont, "Roboto", system-ui, Avenir, Helvetica, Arial, sans-serif` | CONFIRMED |
| Message text | 15 px / 20 px, 400 | INFERRED |
| Sender name | 15 px / 20 px, 500, author colour | INFERRED |
| List row avatar / height | 48 px / 72 px | UNCONFIRMED |
