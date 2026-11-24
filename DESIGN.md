---
name: Temandor
description: Teman mandor. Sketsa jalur duct gaya AutoCAD tanpa harus jago AutoCAD, keluar sebagai DXF berlayer.
colors:
  hazard: "#f2c200"
  hazard-hover: "#ffd31a"
  ink: "#17191c"
  cad-ground: "#14171b"
  cad-deep: "#101317"
  cad-foot: "#0e1013"
  paper: "#f3f2ee"
  panel: "#fbfaf7"
  card: "#ffffff"
  line: "#dfdcd4"
  line-strong: "#c9c5bb"
  hover-tint: "#ece9e1"
  seg-track: "#ebe9e3"
  muted: "#64625d"
  placeholder: "#77756f"
  reading-gray: "#3f3d39"
  selected-wash: "#fffbe6"
  warn-red: "#dc2626"
  danger: "#b91c1c"
  error-ink: "#991b1b"
  error-wash: "#fef2f2"
  done-green: "#15803d"
  stamp-green: "#4ade80"
  tip-red: "#fca5a5"
  sa-screen: "#4ea1ff"
  ea-screen: "#f472b6"
  eq-screen: "#4ade80"
  diff-screen: "#22d3ee"
  sa-paper: "#1d4ed8"
  ea-paper: "#be185d"
  eq-paper: "#15803d"
  diff-paper: "#0e7490"
  sel-screen: "#facc15"
  sel-light: "#c2410c"
  canvas-light: "#f6f7f9"
typography:
  display:
    fontFamily: "Barlow Condensed, sans-serif"
    fontSize: "clamp(2.4rem, 6.2vw, 5.6rem)"
    fontWeight: 700
    lineHeight: 0.92
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Barlow Condensed, sans-serif"
    fontSize: "clamp(2rem, 3.6vw, 3.1rem)"
    fontWeight: 700
    lineHeight: 1
  title:
    fontFamily: "Barlow Condensed, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1
  pane-title:
    fontFamily: "Barlow Condensed, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.08em"
  body:
    fontFamily: "Barlow, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  body-ui:
    fontFamily: "Barlow, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1
  label:
    fontFamily: "Barlow Condensed, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.1em"
  mono:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.08em"
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "12px"
  sheet: "16px"
  pill: "999px"
spacing:
  control: "32px"
  field: "33.6px"
  tool: "36px"
  cta: "44px"
  gap-sm: "8px"
  gap-md: "12px"
  gap-lg: "16px"
components:
  button-primary:
    backgroundColor: "{colors.hazard}"
    textColor: "{colors.ink}"
    typography: "{typography.body-ui}"
    rounded: "{rounded.sm}"
    padding: "0 13.6px"
    height: "{spacing.control}"
  button-primary-hover:
    backgroundColor: "{colors.hazard-hover}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0 13.6px"
    height: "{spacing.control}"
  button-ghost-hover:
    backgroundColor: "{colors.card}"
  field:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0 10.4px"
    height: "{spacing.field}"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.pill}"
    padding: "0 12.8px"
    height: "{spacing.control}"
  chip-pressed:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.card}"
  seg:
    backgroundColor: "{colors.seg-track}"
    rounded: "7px"
    padding: "3px"
  seg-checked:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
  tool:
    textColor: "{colors.card}"
    rounded: "{rounded.sm}"
    size: "{spacing.tool}"
  tool-pressed:
    backgroundColor: "{colors.hazard}"
    textColor: "{colors.ink}"
  rail:
    backgroundColor: "{colors.ink}"
    width: "72px"
  rail-button-pressed:
    backgroundColor: "{colors.hazard}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
  toast:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.card}"
    rounded: "{rounded.lg}"
    padding: "8.8px 14.4px"
  dialog:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
  ai-window:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.sheet}"
    width: "min(24rem, calc(100% - 1.5rem))"
  ai-fab:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.card}"
    rounded: "{rounded.pill}"
    height: "40px"
  mock-badge:
    backgroundColor: "{colors.hazard}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xs}"
  title-block:
    backgroundColor: "{colors.cad-ground}"
    textColor: "{colors.card}"
    padding: "11.2px 14.4px 12.8px"
---

# Design System: Temandor

## Overview

**Creative North Star: "Lembar Gambar Mandor" (the foreman's drawing sheet)**

Temandor looks like the place its drawings live: a dark CAD ground with a fine grid, a drawing in the colours AutoCAD users expect, and around it the plain kit of a site office: warm paper, black ink, hazard tape, condensed stencil headings, mono measurements. Nothing is decorative that a drafter would not recognise. The drawing is the hero on every surface that has one; chrome stays quiet so the SA blue and EA magenta lines read first.

The app is dense and tool-like (32px controls, 13px UI text, panels that float over the canvas), closer to Canva-on-a-CAD-canvas than to a marketing site. The landing page uses the same world at a larger scale: a drawing-sheet frame with zone marks, a title block that is the real "new project" form, red warning pins on the real demo drawing, and paper sections for reading. Honesty is visual too: what is mock wears a hazard-striped MOCK badge, and every export carries the "Sketsa bantu" stamp.

Two grounds, one ink: dark CAD (`cad-ground`) for drawing and site-feel surfaces, warm paper (`paper` / `panel`) for forms, reading, and panels. Hazard yellow is the only action colour on both.

**Key Characteristics:**
- Dark CAD canvas with the 100/500 mm grid; paper for reading and forms.
- Hazard yellow (`hazard`) marks actions, active tools, and focus, nothing else.
- Barlow Condensed caps for headings and labels, Barlow for UI and body, JetBrains Mono for measurements, layer codes, and drawing captions.
- Drawing palette follows CAD convention: SA blue, EA magenta, equipment green, diffuser cyan; red only for real warnings.
- Flat surfaces at rest; soft dark shadows only on things that float over the canvas.
- Plain Indonesian field language; MOCK and "sketsa bantu" are shown, never hidden.

## Colors

A site-office palette: near-black ink, warm paper, one hazard yellow, plus a CAD drawing palette that follows AutoCAD layer convention per theme.

### Primary
- **Hazard Yellow** (`hazard`): primary buttons, pressed tools and rail buttons, the active segment in the title block, focus outlines (2px), field focus glow (at 45% alpha), the `tape` stripe (with ink, 7px bands at -45deg) along the top edge of every page, selection highlight, the MOCK badge. Hover lifts to `hazard-hover`. Tints: callout/note wash at 18-22% alpha, AI tool-call chips at 25-30%.

### Neutral
- **Ink** (`ink`): text on light grounds, the editor rail, toast, tooltip, user chat bubbles, pressed chips and view buttons, `pre` blocks. Text on hazard is always ink.
- **CAD Ground** (`cad-ground`): drawing canvas (screen theme), landing hero and bands, title block, project thumbnails. Deeper steps `cad-deep` (landing punch list) and `cad-foot` (landing footer) only.
- **Paper** (`paper`): app page background and landing reading sections. **Panel** (`panel`): side panels, dialogs, floating bars, AI window. **Card** (`card`, white): fields, cards, list rows on hover, bot chat bubbles.
- **Line** (`line`): every 1px border, divider, ghost-button ring, table rule. **Line Strong** (`line-strong`): hover ring on cards and ghost buttons.
- **Hover Tint** (`hover-tint`, also `#efede7` on panel rows) and **Seg Track** (`seg-track`): quiet fills for hover and the segmented control well.
- **Muted** (`muted`): secondary text, field labels, units, hints (5.5:1 on paper). **Placeholder** (`placeholder`): input placeholders (4.6:1 on white). **Reading Gray** (`reading-gray`): long FAQ answers on paper.
- On dark grounds, secondary text is white at 70-85% alpha; never below 70% for text that must be read. Dark-ground borders are white at 6-28% alpha.

### Status
- **Warning Red** (`warn-red`): validation pins and list numbers, the legend "peringatan" dot. Reserved for real `validate()` warnings. Tooltip headings on ink use `tip-red`.
- **Danger** (`danger`): destructive menu and context-bar items (Hapus). **Error** (`error-wash` bg, `error-ink` text, `#fecaca` border): failed AI messages and tool chips.
- **Done Green** (`done-green`): resolved pin/number fill. **Stamp Green** (`stamp-green`): the "DICEK · SIAP EXPORT" stamp on dark.
- **Selected Wash** (`selected-wash`): pressed tool card background.

### Drawing palette (render.js `PAL`)
Three themes, same layer names. Labels use a lighter step of the stroke on screen.
- **Screen (dark canvas, `cad-ground`)**: SA `sa-screen`, EA `ea-screen`, equipment `eq-screen`, diffuser `diff-screen`, hanger `#8b95a3`, dimension `#9aa3ad`, floor plan `#6b7480`, column `#a3acb8`, opening `#c4b5fd`, architecture `#8792a0`, sketch/coret `#fb923c`, wall fill `#242930`. Selection `sel-screen`; hover stroke `#e2e8f0`.
- **Paper (export PNG/PDF, white)**: SA `sa-paper`, EA `ea-paper`, equipment `eq-paper`, diffuser `diff-paper`, hanger/arch `#64748b`, dimension `#334155`, floor plan `#475569`, column `#1e293b`, opening `#6d28d9`, coret `#c2410c`, wall fill `#e8ebef`.
- **Light canvas**: paper colours on `canvas-light`, wall `#e2e6eb`, grid `#eceff3` / `#dde2e8`. Selection `sel-light`; hover stroke `#0f172a`.
- **Text pick colours** (merah, kuning, hijau, biru, putih) keep their names across themes but swap values for legibility: screen `#f87171 #facc15 #4ade80 #60a5fa #f3f4f6`, paper `#dc2626 #a16207 #15803d #1d4ed8 #111827` ("putih" prints black, like AutoCAD colour 7).

### Named Rules
**The One Action Colour Rule.** Hazard yellow means "you can press this" or "this is active". It never fills a decorative panel, heading, or illustration.

**The Red Means Warning Rule.** Red appears only for real validation warnings and destructive actions. Automatic features get a hazard ring, resolved items turn green. Never use red for emphasis.

**The CAD Convention Rule.** Layer colours follow the drawing palette per theme. Do not restyle SA/EA/equipment colours for brand; drafters read them.

## Typography

**Display Font:** Barlow Condensed (with sans-serif)
**Body Font:** Barlow (with sans-serif)
**Label/Mono Font:** JetBrains Mono (with monospace)

**Character:** Condensed caps read like stencilled site signage and drawing title blocks; Barlow keeps the UI plain and friendly; mono carries anything that is a measurement, a layer code, or a caption on a drawing.

### Hierarchy
- **Display** (700, `clamp(2.4rem, 6.2vw, 5.6rem)`, 0.92, uppercase, balanced): landing hero only; inside the sheet frame it caps at `clamp(2.9rem, 4.1vw, 4.4rem)`.
- **Headline** (700, `clamp(2rem, 3.6vw, 3.1rem)`, 1): landing section heads. Docs h2 is 1.9rem/1.1.
- **Title** (700, 1.875rem / Tailwind `text-3xl`, `leading-none`): app page and panel headings (Proyek, Template, Pengaturan). Punch-list items 1.55rem/1.1, FAQ questions 1.3rem/1.2.
- **Pane title** (700, 15px, 0.08em, uppercase): editor side pane headings.
- **Body** (400, 14-15px app and paper sections, 1.6-1.7 line height for reading, max ~62ch; landing lead 18px): help text, docs, FAQ answers.
- **UI** (600, 13px): buttons, chips, menu items, chat. Secondary UI 12px; tool-card captions 11.5px.
- **Label** (700, 11-12px, 0.1em, uppercase, condensed, `muted`): field labels, library group headers, BOQ group heads, shortcut sections.
- **Mono** (500, 12px, 0.08em, uppercase for title-block cells): title-block captions, drawing captions, layer codes, unit inputs, `kbd` (11px), CAD canvas text, pin numbers (700).

### Named Rules
**The Mono Is For Numbers Rule.** Measurements, units, scales, layer names, and drawing captions are set in JetBrains Mono; prose never is.

**The Caps Are Condensed Rule.** Uppercase text is always Barlow Condensed with tracking (0.08-0.1em) or mono; never uppercase plain Barlow.

## Layout

- **App shell (editor):** full-height canvas. Desktop (>=1024px): ink rail (72px) on the left, a sliding library panel (18rem) that collapses via a handle, the properties panel floating top-right over the canvas (18rem, appears only with a selection), view bar bottom-right, AI pill bottom-centre. The canvas never shifts when right-side panels open.
- **Tablet/phone (<1024px):** the rail becomes a 60px bottom tab bar; library and properties become bottom sheets (max 62dvh, radius 16px top) over a 30% black scrim. Below 640px the AI window is a bottom sheet (min(72%, 32rem)) and the AI pill moves bottom-right.
- **Pages (home, settings, docs, store):** `paper` ground, content in `max-w-6xl`/`max-w-7xl` with 16-24px gutters, 3px tape stripe at the very top.
- **Landing:** sticky 56px dark bar; hero is a drawing sheet (double-line frame, A-F / 1-4 zone marks on desktop) split 0.86fr / 1.14fr, with the title block docked to the bottom-left; phone stacks headline, cropped drawing strip, then title block. The punch list pairs a sticky camera (4:3 desktop, 16:9 phone) with list items of min 38vh.
- **Rhythm:** control heights 32px (buttons, chips, context bar), 33.6px fields, 36px tools and title-block inputs, 40-44px hero CTAs. Gaps mostly 8 / 12 / 16px; panel padding 16-20px; landing sections 64px vertical.

## Elevation & Depth

Flat at rest on paper: depth comes from tonal grounds (paper, panel, white card) and 1px `line` rings. Shadows appear only on things that float above the canvas or page, and they are soft, dark, negative-spread drop shadows paired with a hairline ring (`0 0 0 1px rgb(0 0 0 / .06)`). On dark grounds, hairlines are white at low alpha instead.

### Shadow Vocabulary
- **Press bevel** (`inset 0 -2px 0 rgb(0 0 0 / .18)`): primary button only.
- **Card hover** (`0 3px 10px -5px rgb(0 0 0 / .3)`): tool cards, text presets, AI suggestions, project cards on hover.
- **Floating bar** (`0 8px 24px -8px rgb(0 0 0 / .45)` + hairline): context bar, view bar, inline rename.
- **Menu** (`0 14px 40px -8px rgb(0 0 0 / .5)` + hairline): right-click menu.
- **Panel** (`0 16px 40px -12px rgb(0 0 0 / .5)` + hairline): floating properties panel.
- **Window** (`0 24px 60px -16px rgb(0 0 0 / .6)` + hairline): AI window.
- **Dialog** (`0 30px 80px -20px rgb(0 0 0 / .45)`) over an ink 50% backdrop with 2px blur.
- **Toast** (`0 10px 30px -10px rgb(0 0 0 / .5)` + `inset 0 0 0 1px` hazard at 35%).

### Named Rules
**The Float-Only Shadow Rule.** Only elements that sit over the canvas or page (bars, menus, panels, dialogs, toast, AI window) cast shadows. Cards in a list are flat until hovered.

## Shapes

Gently squared: small radii on controls (6px), larger on containers as they grow (cards 10px, dialogs 12px, floating panel 14px, AI window and sheets 16px), pills for chips, the AI pill, avatars, and tool-call tags. Drawing-world elements stay sharper: the title block and its inputs use 4px or none, the landing sheet frame is square with a double line (1.5px white at 50% + inset 5px gap + 1px white at 20%). Colour swatches are 2px squares; the MOCK badge is 4px with a 1.5px ink border.

## Components

### Buttons
Compact and workmanlike.
- **Shape:** gently rounded (6px), 32px tall, 13px semibold, icon gap 6px.
- **Primary:** hazard fill, ink text, press bevel. Hover `hazard-hover`. Landing CTAs grow to 44px / 15px.
- **Ghost:** transparent with a 1px `line` ring; hover white fill and `line-strong` ring. On dark grounds the ring is white at 22-30%.
- **States:** press scales to 0.97 (100ms); disabled at 55% opacity, no hover; focus-visible 2px hazard outline, 2px offset.
- **Danger:** text-only `danger` red inside menus and the context bar, never a red-filled button.

### Fields
- **Style:** white, 1px `line`, 6px radius, 33.6px tall; label above in condensed caps `muted` 11px; hint below 12px `muted`.
- **Unit field:** same shell with a mono input and a trailing unit (mm, m, inch) in `muted`.
- **Focus:** border goes ink plus a 3px hazard glow at 45%. Placeholders use `placeholder`.
- **Title-block variant (dark):** white 6% fill, white 22% border, 4px radius, mono 15px white; focus border hazard plus 3px glow at 30%.

### Segmented control (seg)
SA/EA, inch/mm, theme choices. A `seg-track` well with 3px padding (7px radius); options 28.8px tall, semibold `muted`; checked option is white with ink text and a 1px shadow. Keyboard: native radios, focus-visible hazard outline on the label. Dark title-block variant: checked segment is hazard with ink text, mono labels.

### Chips
Filter chips on home and store: pill, 32px, 13px semibold `muted` with a `line` ring; hover ink text on white; `aria-pressed="true"` is ink fill, white text, no ring. Option cards (export format) are 8px white cards whose checked state is an ink 1px inset ring.

### Dialogs
Native `<dialog>`: `panel` ground, 12px radius, dialog shadow, ink 50% blurred backdrop, 160ms pop-in. Opened via `data-open`, closed via `data-close`. Primary action right, ghost cancel beside it.

### Toast
Ink pill-rectangle (10px), white 13px text, bottom-centre above the status area, hazard hairline. Shows 2.8s; with an action (for example "Urungkan") it shows 6s and the action is a hazard-text button at least 32px tall. `role="status"`. Every destructive action offers Urungkan here.

### Panels and rail
- **Rail:** ink column, 72px, icon over 11px label, white 70% at rest, hover white 8% wash, pressed hazard fill with ink text (10px radius), press 0.95.
- **Library panel:** `panel` ground; collapsible groups with condensed caps headers; items are icon-over-label tiles that gain a white fill and `line` ring on hover. Collapse handle on the panel edge turns hazard on hover.
- **Properties panel:** floats over the canvas (desktop) with the Panel shadow, 14px radius; slides in from the right (280ms) only when something is selected.
- **Tool cards:** white, `line` ring, 10px; hover `line-strong` + card-hover shadow; pressed ink inset ring on `selected-wash`.
- **Editor tools (dark top bar):** 36px icon squares, white 65% at rest, pressed hazard. View bar buttons: 32px, pressed ink with white icon.
- **Layer rows:** swatch (12px, 2px radius) + name + lock; unchecked layers dim to 40%.

### Floating AI window
- **Entry:** ink pill (40px) at bottom-centre of the canvas with a hazard sparkle icon; hover adds a 3px hazard ring at 35%. Hidden while the window is open.
- **Window:** `panel`, 16px radius, Window shadow, docked right in the properties slot (they alternate, so the edited drawing stays visible), slides in from 16px right (260ms). Phone: bottom sheet.
- **Messages:** user bubbles ink/white with a 4px tail corner; bot bubbles white with `line` ring; errors in the error wash. Tool calls render as small pills (hazard 25%, "✓ " prefix; errors red-wash with "! "), with a ghost "Urungkan" pill. Typing indicator is three 6px `muted` dots.
- **Input:** white, `line` ring, 10px; focus-within ink border + hazard glow.

### Title block (kop gambar)
The landing's signature and the project-start form. Sits at the bottom of the drawing sheet on `cad-ground`, separated by a 1.5px white 50% rule. Header row: TEMANDOR in condensed 15px hazard + "LEMBAR BARU · SKALA 1:100" in mono. Rows are a two-column grid with white 28% hairlines; each cell has a mono 12px uppercase caption over its input. Footer holds the hazard CTA and one line of plain reassurance.

### Pins and punch list
Numbered pins on leader lines at real component coordinates. Warning: red dot, white mono number, red halo. Automatic feature: ink dot with hazard ring and hazard number. Done: green dot with a check. The active pin's halo pings (1.6s). List numbers (33.6px circles) mirror the pin states. The closing stamp is a rotated (-4deg) 2px green-outlined mono label.

### MOCK badge and tape
- **MOCK badge:** hazard fill, ink text, condensed 700 12px with 0.08em tracking, 1.5px ink border, 4px radius, with a 14px hazard-stripe square. Text is "MOCK" or "PROTOTYPE · P1". Required on every surface or section that is not real (login, checkout, seller, template store, settings account).
- **Tape:** 3px hazard/ink diagonal stripe across the top of every page header.

### BOQ table and docs tables
Full-width, collapsed borders, 14px; rows separated by `line`; second column `muted` 13px; last column fixed 7.5rem, medium weight. Group heads use the Label style.

## Do's and Don'ts

### Do:
- **Do** keep hazard yellow for actions, active state, focus, and the MOCK badge; text on it is always ink.
- **Do** draw with the `PAL` palette for the current theme (screen, paper, light) and keep SA blue / EA magenta conventions.
- **Do** set measurements, units, scales, and layer codes in JetBrains Mono.
- **Do** give every interactive element a 2px hazard focus-visible outline and a target of at least 24px (most controls are 32px).
- **Do** keep text contrast at 4.5:1 or better: `muted` on paper, white at no less than 70% on dark, `placeholder` for placeholders.
- **Do** keep the canvas keyboard-operable (`#cad` takes focus with an inset hazard outline) and give icon-only buttons an `aria-label` and a title with the shortcut.
- **Do** use one authored motion moment per surface (landing: the punch-list camera pan with pin turning green; editor: panels sliding over a fixed canvas). Everything else is a 120-300ms state change on `cubic-bezier(.2,.8,.2,1)`.
- **Do** honour `prefers-reduced-motion`: all animations and transitions off, pin pings stop, the punch-list camera re-frames instantly, smooth scroll only with no-preference.
- **Do** write in plain everyday Indonesian with field terms (duct, elbow, gantungan, ujung terbuka), not CAD jargon; offer "Urungkan" after destructive actions.
- **Do** say "sketsa bantu – cek ulang ukuran di lapangan" on exports, and mark unreal parts MOCK or PROTOTYPE.

### Don't:
- **Don't** use red for anything but real validation warnings and destructive actions, and don't show "Aman" unless there are zero warnings.
- **Don't** put shadows on resting list cards or paper sections; shadows belong to floating layers.
- **Don't** set uppercase in plain Barlow or put uppercase eyebrow labels above headings.
- **Don't** use typed glyphs (‹ « ✕ ▸ ◐) as icons on new surfaces; use inline SVG at 16-20px with `currentColor`.
- **Don't** present mock data (seller names, ratings, prices) as social proof, or claim features listed as not built (BOQ otomatis, RA/FA, cloud).
- **Don't** add a second accent colour or recolour the drawing for brand.
