# Telegram Web K — palette & visual metrics

Source: live build served at <https://web.telegram.org/k/> (app `2.2 (676)`, langPack `webk`).
Provenance tags: **(a)** documented/known theme param · **(b)** recovered from the served bundle ·
**(c)** UNCONFIRMED.
Artifacts cached in `.cache/tgweb/` (git-ignored).

## How to reproduce

```bash
cd .cache/tgweb
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
curl -s -L -A "$UA" https://web.telegram.org/k/ -o index.html
grep -o -E '(src|href)="[^"]*"' index.html | sort -u            # finds ./index-BIXs87ON.css, ./index-CBuWbkpt.js, ./themeController-*.js
curl -s -L -A "$UA" https://web.telegram.org/k/index-BIXs87ON.css -o index-BIXs87ON.css
curl -s -L -A "$UA" https://web.telegram.org/k/index-CBuWbkpt.js  -o index-CBuWbkpt.js
curl -s -L -A "$UA" https://web.telegram.org/k/themeController-8OcPSpCQ.js -o themeController.js
curl -s -L -A "$UA" https://web.telegram.org/k/state-y9uiDo1B.js -o state.js   # name from __vite__mapDeps
curl -s -L -A "$UA" https://web.telegram.org/k/assets/img/pattern.svg -o pattern.svg

grep -o -i -E '#[0-9a-f]{6}\b' index-BIXs87ON.css | sort | uniq -c | sort -rn
grep -o -E -- '--[a-z-]*(color|background)[a-z-]*:[^;}]*' index-BIXs87ON.css | sort -u
grep -o -E '\-\-[a-zA-Z0-9-]+:[^;}]*' index-BIXs87ON.css | sort -u      # CSS custom properties
python3 -c "s=open('themeController.js').read();i=s.find('J={day:');print(s[i:i+2400])"   # all 4 theme palettes
python3 -c "s=open('state.js').read();i=s.find('var I={');print(s[i:i+1600])"             # accent + wallpaper presets
```

Bundles **are** minified (one line each) but the palette objects are literal maps — fully recoverable; `#eeffde` is (c) UNCONFIRMED.

## Light theme

Default theme name is `day` (base `baseThemeClassic`). Literals live in `themeController-8OcPSpCQ.js` @ offset **3748**.

| role | value | how obtained |
|---|---|---|
| column / list / incoming-bubble surface `--surface-color`, `--message-background-color` | `#ffffff` | (b) themeController J.day |
| page background `--body-background-color` | `#ffffff` | (b) themeController J.day |
| app/scrim background `--background-color` | `#f4f4f5` | (b) themeController J.day |
| primary text `--primary-text-color` | `#000000` | (b) themeController J.day |
| secondary / hint text `--secondary-text-color` (→ WebApp `hint_color`) | `#707579` | (b) themeController J.day |
| disabled/secondary `--secondary-color` | `#c4c9cc` | (b) themeController J.day |
| border `--border-color` | `#dfe1e5` | (b) themeController J.day |
| link `--link-color` | `#00488f` | (b) themeController J.day |
| danger | `#df3f40` | (b) themeController J.day |
| saved messages | `#359ad4` | (b) themeController J.day |
| green | `#70b768` | (b) themeController J.day |
| search input bg | `#ffffff` | (b) themeController J.day |
| chat-list hover `--light-filled-secondary-text-color` | `#f3f3f4` | (b) derived: mix(#707579 → #ffffff, 8 %) |
| outgoing bubble bg `--message-out-background-color` | `#e3fee0` | (b) derived in `applyTheme()` from `message_colors[0]=#5ca853` |
| outgoing bubble text `--message-out-primary-color` | `#5ca853` | (b) derived (`g(L)`) |
| default wallpaper gradient | `#dbddbb` `#6ba587` `#d5d88d` `#88b884` (intensity 50) | (b) state.js default theme `Z` |

## Dark theme

Theme name `night` (base `baseThemeNight`); also `html.night{…}` in the CSS, plus a runtime-injected `.night{…}` `<style>`.

| role | value | how obtained |
|---|---|---|
| surface / incoming bubble `--surface-color`, `--message-background-color` | `#212121` | (b) themeController J.night |
| page + app background `--body-background-color`, `--background-color` | `#181818` | (b) themeController J.night |
| primary text | `#ffffff` | (b) themeController J.night |
| secondary / hint text | `#aaaaaa` | (b) themeController J.night |
| disabled/secondary `--secondary-color` | `#707579` | (b) themeController J.night |
| border | `#0f0f0f` | (b) themeController J.night |
| link / accent | `#8774e1` | (b) themeController J.night |
| danger | `#ff595a` | (b) themeController J.night |
| green | `#5cc85e` | (b) themeController J.night |
| search input bg / border | `#181818` / `#2f2f2f` | (b) themeController + `html.night` |
| chat-list hover | `#2b2b2b` | (b) derived mix(#aaaaaa → #212121, 8 %) |
| outgoing bubble bg | `#8774e1` | (b) derived (night uses alpha 1 ⇒ = `message_colors[0]`) |
| default wallpaper gradient | `#fec496` `#dd6cb9` `#962fbf` `#4f5bd5` (intensity −50) | (b) state.js default theme `Z` |
| spoiler bg | `#373e4e` | (b) `html.night` |
| ripple / skeleton | `#ffffff14` / `#ffffff1f` | (b) `html.night` |

Extra palettes in the same object: **tinted** — accent `#3685fa`, surface `#1d2733`, bubble `#232e3b`, bg `#151e27`,
text `#ffffff`, secondary `#7d8b99`, border `#0f151b`, link `#5eabe1`.
**light** — accent `#2d7ed5`, bubble `#f0f0f0`, surface `#ffffff`, text `#333333`, secondary `#8c8e91`, bg `#f4f4f5`.

## Accent / brand colours

Accent presets, `state-y9uiDo1B.js` (`N={blue:35071,…}`) → decoded:

| blue | `#0088ff` | | purple | `#9472ee` |
| cyan | `#00c2ed` | | red | `#d33213` |
| green | `#29b327` | | yellow | `#edb400` |
| pink | `#eb6ca4` | | gray | `#6d839e` |
| orange | `#f08200` | | night-blue override | `#3e88f7` |

- `#3390ec` — **(b)** live default accent, confirmed in the bundle (`J.day["primary-color"]`, also `--gc-blue-text-color`).
- `#8774e1` — **(b)** confirmed night accent.
- `#2d7ed5` — **(b)** confirmed "light" theme accent.
- `#0088cc` — **(a)** Telegram brand blue ([brandcolor.dev/brands/telegram](https://brandcolor.dev/brands/telegram), `--tg-primary` in Mini App templates); **not** present in this bundle → (c).
- `#5288c1` — **(c) UNCONFIRMED**: not found in any served asset; do not rely on it for this build.
- Verified negatives: `#eeffde`, `#5288c1`, `#64b5f6` do **not** appear in the CSS or any JS chunk.

## Message bubbles

- Incoming `--message-background-color`: `#ffffff` light / `#212121` dark. Outgoing: `#e3fee0` light / `#8774e1` dark.
- Outgoing text `--message-out-primary-color`: `#5ca853` light / `#ffffff` dark.
- Corner radius `--border-start-start/end`, `--border-end-*` (logical): base **15px** everywhere;
  `.bubble.is-in` → `5px 15px 15px 5px` (LTR), `.bubble.is-out` → `15px 5px 5px 15px`;
  1st/last of a group resets its two top/bottom corners to 15px; the tail corner goes to **0** on
  `.is-group-last.can-have-tail`; `.bubble.with-reply-markup` forces bottom corners to 5px; `.service` bubbles 0.875rem.
- Tail: inline SVG symbol `#message-tail-filled`, `viewBox="0 0 11 20"`, rendered 11×20px,
  `fill: var(--message-background-color)`, `bottom:0`, `translateY(1px)`, offset `-8.4px` inward,
  mirrored with `scaleX(var(--reflect))`. Path:
  `M-6 16h6v17c-.193-2.84-.876-5.767-2.05-8.782-.904-2.325-2.446-4.485-4.625-6.48A1 1 0 01-6 16z` in `matrix(1 0 0 -1 0 49)`.
- Size: `min-width: 56px`; `--max-width: 30rem` in normal chats (100 % in broadcast),
  `85 %` for `.bubble:not(.service)` ≥601px, `calc(100% - 5.5625rem)` ≤600px.
- Shadow: `.bubble-content { box-shadow: 0 1px 2px #10232f26 }` (none for `.just-media`).
- Spacing: `margin-bottom: 0.125rem`; `.bubbles` side padding `0.5rem` desktop / 0 mobile.
- Floating timestamp pill: `--message-time-background: #00000059`, radius 0.75rem, text `#fff`.

## Chat list

- Row base background: `transparent` (shows `--surface-color`).
- **Selected** `.chatlist-chat.active`: `background = var(--primary-color)` → `#3390ec` light / `#8774e1` dark;
  all title/subtitle/icons forced `#ffffff`; unread badge inverts to `color:#3390ec; background:#fff`.
- **Hover/active/menu-open**: `var(--light-filled-secondary-text-color)` → `#f3f3f4` light / `#2b2b2b` dark.
- **Unread badge / mention**: `--chatlist-status-color` → `--avatar-online-color` → `var(--primary-color)`
  (`#3390ec` / `#8774e1`), text `--badge-text-color:#fff`, `--size:1.375rem` (22px), `border-radius:11px`,
  `padding:0 7px`, `font-size:.875rem`, `font-weight:500`.
- Pinned/muted colour `--chatlist-pinned-color`: `#a2abb2` light, `--secondary-color` (`#707579`) dark.
- Row title: `font-size:16px`, `line-height:1.375rem`.
- Window shape: the two columns sit inside `--page-chats-padding` (**8px**), and the left
  column carries `border-radius:24px` (`--main-column-border-radius`) plus
  `box-shadow: var(--column-box-shadow)` = `0 0 4px var(--column-box-shadow-color)`.

## Typography

- `--font-regular: "Roboto", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif`
- `--font-rounded: -ui-rounded, "Numbers Rounded", "Roboto", "Helvetica Neue", sans-serif`
- `--font-monospace: "Roboto Mono", monospace`
- `html { font-size:16px; font-weight:400; line-height:1.5; -webkit-font-smoothing:antialiased }`
- Size scale vars: `--font-size-10/11/12/13/14/15/16/18/20/24` = 10…24px.
- Messages: `--messages-text-size:16px`, `--messages-line-height:1.3125`,
  secondary `14px`, time `12px`, service `15px`.
- Weights: `--font-weight-normal:400`, `--font-weight-bold:500`.

## Wallpaper

- Default is the built-in `slug:"pattern"` wallpaper → **`assets/img/pattern.svg`**, an Adobe-exported
  1440×2960 doodle SVG (~507 KB). Fetched OK with the same curl command.
- It is **not** a CSS `background-image` in the stylesheet: JS renders a 4-colour gradient onto a
  `<canvas class="_GradientCanvas_…">` (height 150 %, `top:-25 %`) and the doodle onto a second canvas
  (`. _CanvasCommon_… { object-fit:cover; opacity:var(--opacity-max,1) }`) layered with
  `mix-blend-mode: soft-light` (`. _Blend_…`); dark/tinted themes add `filter: invert()` (`. _DarkPatternInvert_…`).
- Gradient stops per theme (intensity = pattern opacity %):
  `day` `#dbddbb #6ba587 #d5d88d #88b884` @50 · `night` `#fec496 #dd6cb9 #962fbf #4f5bd5` @−50 ·
  `light` `#b1e0fa #82b0d8 #a0d8e8 #e5f0f8` @50 · `tinted/blue` `#1e3557 #182036 #1c4352 #16263a` @−40
  (per-accent variants exist for cyan/green/pink/orange/purple/red/yellow/gray).
- Cheap clone: `background:#dbddbb url(pattern.svg) repeat; background-size:cover;` + a `soft-light` overlay, or a 4-stop `linear-gradient` under the SVG.
- **As shipped in `apps/telegram`.** The doodle is bundled as `src/assets/telegram-pattern.svg`, a copy of
  <https://twallpaper.js.org/patterns/animals.svg> (the TWallpaper project's redistribution of this Telegram
  artwork; monochrome `#000` strokes, viewBox 1440×2960, `stroke-width: 3`, ~222 KB). It is painted as a
  two-layer CSS `background-image` of that file at `background-size: 760px auto, 545px auto`
  (`background-position: 0 0, 380px 520px`) rather than onto a canvas, with `opacity: 0.13` +
  `filter: invert(1)` in the dark theme and `opacity: 0.12` in the light one; there is no
  `mix-blend-mode`. The four-point gradient under it (`--tg-wallpaper-*`) is ours. The asset is Telegram's
  artwork, **not** freely licensed — it must be replaced with an own tile or licensed before any public
  release (see the app README's licensing note).
