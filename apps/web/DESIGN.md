---
version: "alpha"
name: "Quiet Dark"
description: "Near-black with a warm undertone, one gold accent, grain, and generous space."
colors:
  primary: "#d4a054"
  on-primary: "#14120e"
  surface: "#0e0d0b"
  surface-container: "#1a1815"
  on-surface: "#ece8e1"
  on-surface-variant: "#8a857c"
  outline: "#26241f"
  fg-bright: "#f2eee7"
  fg-soft: "#b9b4aa"
  border-strong: "#3d3a33"
typography:
  headline-display:
    fontFamily: "Inter"
    fontSize: 118px
    fontWeight: 200
    lineHeight: 0.9
    letterSpacing: -0.058em
  headline-italic:
    fontFamily: "Instrument Serif"
    fontSize: 118px
    fontWeight: 400
  body-md:
    fontFamily: "Inter"
    fontSize: 15px
    fontWeight: 300
    lineHeight: 1.75
  label-md:
    fontFamily: "JetBrains Mono"
    fontSize: 10px
    fontWeight: 400
    letterSpacing: 0.22em
rounded:
  md: 6px
spacing:
  unit: 4px
  section: 104px
  max-width: 1200px
---

# Quiet Dark

> Near-black with a warm undertone, one gold accent, grain, and generous space.

Source: https://flavors.design/f/quiet-dark

## Overview

Quiet Dark is a desk lamp in a dark study at 23:00: warm black paper, one pool of amber light, a machined kitchen-timer dial and a ledger written in thin pencil. The demo sells Hush, a focus timer that holds every notification, and every component is an instrument of that ritual: a session dial in the hero, a redacted held-pile ledger, a week-by-hour heatmap, keycaps, a monthly changelog. Type does the drama: ultralight Inter at 118px with one word turned into Instrument Serif italic. It suits calm premium tools, journaling and focus apps, private banking, audio. It is not neon cyberpunk, glossy SaaS glass, soft rounded pastel minimalism, or gold-foil luxury.

## Colors

| Role          | Value     | Notes                                               |
| ------------- | --------- | --------------------------------------------------- |
| bg            | `#0e0d0b` | warm near-black page                                |
| bg-2          | `#1a1815` | half-step raised surface (featured tier, side card) |
| fg            | `#ece8e1` | warm body text                                      |
| fg-muted      | `#8a857c` | labels, secondary copy, mono metadata               |
| accent        | `#d4a054` | the only hue: actions, dial arc, live values        |
| accent-fg     | `#14120e` | ink on gold                                         |
| border        | `#26241f` | hairlines                                           |
| fg-bright     | `#f2eee7` | display type and big numerals                       |
| fg-soft       | `#b9b4aa` | subheads, italic serif words in the hero            |
| border-strong | `#3d3a33` | outlined buttons, keycaps, dial outer ring          |

Scheme: dark. Contrast rule: body ≥ 12:1 on bg, muted ≥ 4.8:1, never smaller than 10px.
Color rules: gold is the only hue and it marks time, action or state (arc, primary button, released time, live dot); every tint is `color-mix()` of these ten variables; the lamp is a single radial gradient of the accent, top right.

## Typography

- Display: `"Inter", ui-sans-serif, system-ui, -apple-system, sans-serif` — weight 200, tracking `-0.045em` to `-0.058em`, sentence case, line-height 0.9–1.02
- Serif accent: `"Instrument Serif", ui-serif, Georgia, serif` — italic 400, exactly one word per headline ("finally", "no", "quietly", "after.")
- Body: `"Inter"` — 14–18px, weight 300, line-height 1.65–1.75, `tnum` on
- Mono: `"JetBrains Mono", ui-monospace, SFMono-Regular, monospace` — 10px uppercase labels at `0.16–0.22em`, times, versions, keycaps
- Scale: 10 / 12 / 14 / 15 / 17 / 18 / 22 / 52 / 64 / 58–104 (dial) / 54–118 (h1)
- Load: `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400;500&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">`
- Rules: display is never bolder than 300; numerals are ultralight with a tiny gold mono unit as superscript (`92` + `min`); no uppercase outside mono labels.

## Layout

- Max width 1200px, gutters 40px desktop and 24px under 900px
- Base unit 4px; spacing scale 4 / 8 / 12 / 16 / 24 / 32 / 56 / 96px
- Section rhythm 104px vertical, 72px on mobile; the final CTA gets 128px
- Grid: hero `1.1fr 0.9fr` (copy / dial); section heads `0.8fr 1.2fr` with the lede bottom-aligned on the right; three-up rule rows; `1.55fr 0.85fr` ledger plus side card
- Density: airy — modules are compact and tabular, the dark between them is generous
- Everything collapses to one column under 900px; stats go 2×2; the heatmap keeps 24 columns and shrinks its gap

## Elevation & Depth

Lamplight in a dark room: nothing floats, one pool of warm light, grain over everything.

- Hairlines are `1px solid var(--border)` (`#26241f`) and they are the structure: full-bleed section tops (`.rule`), vertical rules between stats, rule cards and tiers, ledger rows, FAQ rows.
- `--shadow: none`. There is no `box-shadow` or `text-shadow` anywhere. Keycaps fake depth with `border: 1px solid var(--border-strong); border-bottom-width: 4px`, collapsing to 1px on hover.
- The lamp: `.flavor::after` is a 1100px circle at `top: -260px; right: -120px` filled with `radial-gradient(closest-side, color-mix(in srgb, var(--accent) calc(var(--lamp) * 1%), transparent), … 55%, transparent)`; `--lamp` defaults to 16.
- Grain: `.flavor::before` is `position: fixed; inset: 0; z-index: 30; pointer-events: none; opacity: var(--grain); mix-blend-mode: screen` with an inline-SVG `feTurbulence` (`baseFrequency .82`, 3 octaves) tiled at 220px.
- Surfaces: `var(--bg-2)` only on the featured tier (with a 1px gold top rule via `::before`) and the let-through card; the dial face is `color-mix(in srgb, var(--bg-2) 70%, var(--bg))`.
- Focus: `outline: 1px solid var(--accent); outline-offset: 3px`. Forbidden: glass blur, glows around buttons, cool greys.

## Shapes

- Radius: `6px` (`--radius`, `--radius-lg`) on buttons, keycaps, the side card and ghost notifications; tiers, stats and rule cards are square regions bounded by hairlines
- Circles belong to time: the session dial (520px, ticks every 6°, majors every 30°), the 132px quit ring, 48px tier rings, 5px status dots
- Heatmap cells are squares with a 2px radius; redaction bars are 8px tall with a 2px radius
- The dial arc and every ring use `stroke-linecap: round`

## Components

- Session dial (hero): SVG drawn by JS from `--progress`, `--ticks` and `--dial-tilt`; gold arc for time remaining with a dot and 12px halo at its tip, ticks inside the arc turn gold, mono quarter indices 00/15/30/45, a 104px ultralight countdown in the middle, three mono readouts below on hairlines
- Buttons: 46px, 12×24 padding, 15px medium; primary gold with a `kbd` hint (`⌃⌥H`) at 62% opacity; secondary transparent with `--border-strong`, gold on hover
- Nav: 64px, mono 10px uppercase links, outlined gold Download button
- Stats: 52px ultralight numerals, gold mono superscript unit, mono label
- House rules: three hairline columns, each with a 220px plate illustrating the rule in the idiom (stacked ghost notifications, three keycaps, a quit ring) then an indexed title
- Held pile: a ledger table (time, sender, redacted message bar, released time in gold) next to a `--bg-2` let-through card with two contacts and a tally
- Week heatmap: 7×24 hour grid, `--v` per cell mixes the accent into `color-mix(in srgb, var(--fg) 5%, transparent)`; stat rows beside it
- Testimonials: one large Instrument Serif italic pull quote with a gold opening mark, two smaller notes; footers are mono with a gold session tag
- Pricing: hairline tiers with a ring showing how much of the day each plan covers; featured tier on `--bg-2` with a gold top rule
- Changelog: date / version / sentence rows; hover nudges the row 10px right
- FAQ: hairline details, gold `+` rotating 45° when open

## Do's and Don'ts

- Do keep one gold per idea and let it mean time or action.
- Do set headlines at weight 200 and turn exactly one word into serif italic.
- Do draw product objects (dials, keycaps, ledgers) in hairlines instead of using cards.
- Do put small mono units and labels next to big ultralight numbers.
- Do keep the lamp gradient and grain; they are what make the black feel warm.
- Do give JS-drawn pieces a correct first frame from `:root`.

- Don't add a second hue, gradients on buttons, or glows around text.
- Don't use drop shadows; keycap depth is a thicker bottom border.
- Don't set display type bold or uppercase.
- Don't wrap every module in a bordered rounded card.
- Don't use cool blue-greys for neutrals.
- Don't animate continuously except the countdown colon and live dots.

## Motion

- Duration 340ms for hovers, 900ms for the entrance, easing `cubic-bezier(0.22, 0.8, 0.24, 1)`
- What animates: hero children rise 14px with 80ms stagger; the dial arc draws from zero over 1.6s, then the tip dot fades in; the countdown ticks once per second with a blinking colon; live dots breathe on 2.4s; keycaps press on hover; FAQ `+` rotates
- What never animates: grain, lamp, hairlines, heatmap layout
- Signature move: the gold arc sweeping round the dial on load
- All motion sits inside `@media (prefers-reduced-motion: no-preference)`; the clock only ticks there too

## Tweaks

- `--progress` (Time remaining, 0.05–1): arc length, gold ticks and tip position on the dial
- `--ticks` (Dial ticks, 24–120): tick density; majors stay at every twelfth
- `--lamp` (Lamp, 0–40): strength of the accent pool behind the hero
- `--grain` (Grain, 0–0.14): opacity of the fractal noise overlay
- `--dial-tilt` (Dial tilt, 0–50deg): lays the dial back on the desk with `rotateX`
- Schemes: Ember (red-orange coal), Verdigris (patina green), Moonlit (lavender on blue-black), Vellum (light paper with dark gold)

## Reference CSS

```css
:root {
  --bg: #0e0d0b;
  --bg-2: #1a1815;
  --fg: #ece8e1;
  --fg-muted: #8a857c;
  --accent: #d4a054;
  --accent-fg: #14120e;
  --border: #26241f;
  --fg-bright: #f2eee7;
  --fg-soft: #b9b4aa;
  --border-strong: #3d3a33;
  --font-display: "Inter", ui-sans-serif, system-ui, -apple-system, sans-serif;
  --font-body: "Inter", ui-sans-serif, system-ui, -apple-system, sans-serif;
  --font-serif: "Instrument Serif", ui-serif, Georgia, serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;
  --radius: 6px;
  --radius-lg: 6px;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 56px;
  --space-8: 96px;
  --shadow: none;
  --ease: cubic-bezier(0.22, 0.8, 0.24, 1);
  --dur: 340ms;
  --max-width: 1200px;
  --progress: 0.62;
  --ticks: 60;
  --lamp: 16;
  --grain: 0.05;
  --dial-tilt: 0;
}

.dial .arc {
  fill: none;
  stroke: var(--accent);
  stroke-width: 2.5;
  stroke-linecap: round;
}

.key {
  width: 64px;
  height: 64px;
  border: 1px solid var(--border-strong);
  border-bottom-width: 4px;
  border-radius: var(--radius);
  background: var(--bg-2);
  font: 400 20px var(--font-mono);
}

.tier.featured {
  background: var(--bg-2);
}
.tier.featured::before {
  content: "";
  position: absolute;
  top: -1px;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--accent);
}
```

## Reference markup

```html
<div class="dial-wrap" aria-label="Session 118, 37 minutes remaining">
  <div class="dial">
    <svg id="dial" viewBox="0 0 520 520" aria-hidden="true"></svg>
    <div class="readout">
      <p class="eyebrow label"><span class="dot live"></span>Session 118</p>
      <p class="time" id="clock">37<i>:</i>12</p>
      <p class="unlock">quit unlocks at <b>14:39</b></p>
    </div>
  </div>
  <div class="dial-meta">
    <div><p class="label">Quiet since</p><b>14:02</b></div>
    <div><p class="label">Held back</p><b>64</b></div>
    <div><p class="label">Let through</p><b>0</b></div>
  </div>
</div>
```

## How to apply this flavor

1. Replace the target page's design tokens with the palette, fonts and spacing above.
2. Find the product's one physical object (a dial, a ledger, a key) and draw it in hairlines as the hero.
3. Restyle components to match the Components section; keep the page's content and structure.
4. Apply the motion rules; remove any animation not described here.
5. Check the Don't list before finishing.

## shadcn/ui Usage

### Install

Add this flavor's theme with `npx shadcn@latest add https://flavors.design/r/quiet-dark.json`. The CLI has no cookie — Pro users append `?key=YOUR_API_KEY` (Settings → API keys). Install primitives with `npx shadcn@latest add button card input textarea select dialog sheet tabs badge separator checkbox switch slider tooltip dropdown-menu table`.

### Theme variables

```css
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400;500&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap");

:root {
  --accent: #22211e;
  --accent-foreground: #ece8e1;
  --background: #0e0d0b;
  --border: #26241f;
  --card: #1a1815;
  --card-foreground: #ece8e1;
  --chart-1: #d4a054;
  --chart-2: #ece8e1;
  --chart-3: #8a857c;
  --chart-4: #b9b4aa;
  --chart-5: #3d3a33;
  --destructive: #f87171;
  --destructive-foreground: #0e0d0b;
  --foreground: #ece8e1;
  --input: #26241f;
  --muted: #22211e;
  --muted-foreground: #918e89;
  --popover: #1a1815;
  --popover-foreground: #ece8e1;
  --primary: #d4a054;
  --primary-foreground: #14120e;
  --radius: 6px;
  --ring: #d4a054;
  --secondary: #22211e;
  --secondary-foreground: #ece8e1;
  --sidebar: #1a1815;
  --sidebar-accent: #22211e;
  --sidebar-accent-foreground: #ece8e1;
  --sidebar-border: #26241f;
  --sidebar-foreground: #ece8e1;
  --sidebar-primary: #d4a054;
  --sidebar-primary-foreground: #14120e;
  --sidebar-ring: #d4a054;
}

.dark {
  --accent: #22211e;
  --accent-foreground: #ece8e1;
  --background: #0e0d0b;
  --border: #26241f;
  --card: #1a1815;
  --card-foreground: #ece8e1;
  --chart-1: #d4a054;
  --chart-2: #ece8e1;
  --chart-3: #8a857c;
  --chart-4: #b9b4aa;
  --chart-5: #3d3a33;
  --destructive: #f87171;
  --destructive-foreground: #0e0d0b;
  --foreground: #ece8e1;
  --input: #26241f;
  --muted: #22211e;
  --muted-foreground: #918e89;
  --popover: #1a1815;
  --popover-foreground: #ece8e1;
  --primary: #d4a054;
  --primary-foreground: #14120e;
  --radius: 6px;
  --ring: #d4a054;
  --secondary: #22211e;
  --secondary-foreground: #ece8e1;
  --sidebar: #1a1815;
  --sidebar-accent: #22211e;
  --sidebar-accent-foreground: #ece8e1;
  --sidebar-border: #26241f;
  --sidebar-foreground: #ece8e1;
  --sidebar-primary: #d4a054;
  --sidebar-primary-foreground: #14120e;
  --sidebar-ring: #d4a054;
}

[data-flavor-scheme="ember"] {
  --accent: #261f1c;
  --accent-foreground: #f0e4dc;
  --background: #120b09;
  --border: #2e201b;
  --card: #1f1411;
  --card-foreground: #f0e4dc;
  --chart-1: #e0673f;
  --chart-2: #f0e4dc;
  --chart-3: #94817a;
  --chart-4: #c1ada4;
  --chart-5: #4a342c;
  --destructive: #f87171;
  --destructive-foreground: #120b09;
  --foreground: #f0e4dc;
  --input: #2e201b;
  --muted: #261f1c;
  --muted-foreground: #958b86;
  --popover: #1f1411;
  --popover-foreground: #f0e4dc;
  --primary: #e0673f;
  --primary-foreground: #1a0c07;
  --radius: 6px;
  --ring: #e0673f;
  --secondary: #261f1c;
  --secondary-foreground: #f0e4dc;
  --sidebar: #1f1411;
  --sidebar-accent: #261f1c;
  --sidebar-accent-foreground: #f0e4dc;
  --sidebar-border: #2e201b;
  --sidebar-foreground: #f0e4dc;
  --sidebar-primary: #e0673f;
  --sidebar-primary-foreground: #1a0c07;
  --sidebar-ring: #e0673f;
}

[data-flavor-scheme="verdigris"] {
  --accent: #1e2221;
  --accent-foreground: #e3ebe6;
  --background: #0a0e0d;
  --border: #1f2825;
  --card: #141a18;
  --card-foreground: #e3ebe6;
  --chart-1: #8fc9a8;
  --chart-2: #e3ebe6;
  --chart-3: #7f8d86;
  --chart-4: #aebbb4;
  --chart-5: #34413c;
  --destructive: #f87171;
  --destructive-foreground: #0a0e0d;
  --foreground: #e3ebe6;
  --input: #1f2825;
  --muted: #1e2221;
  --muted-foreground: #7f8d86;
  --popover: #141a18;
  --popover-foreground: #e3ebe6;
  --primary: #8fc9a8;
  --primary-foreground: #0b1510;
  --radius: 6px;
  --ring: #8fc9a8;
  --secondary: #1e2221;
  --secondary-foreground: #e3ebe6;
  --sidebar: #141a18;
  --sidebar-accent: #1e2221;
  --sidebar-accent-foreground: #e3ebe6;
  --sidebar-border: #1f2825;
  --sidebar-foreground: #e3ebe6;
  --sidebar-primary: #8fc9a8;
  --sidebar-primary-foreground: #0b1510;
  --sidebar-ring: #8fc9a8;
}

[data-flavor-scheme="moonlit"] {
  --accent: #1f2026;
  --accent-foreground: #e4e5ee;
  --background: #0b0c12;
  --border: #23253a;
  --card: #151722;
  --card-foreground: #e4e5ee;
  --chart-1: #b8b2ff;
  --chart-2: #e4e5ee;
  --chart-3: #83869a;
  --chart-4: #b1b3c4;
  --chart-5: #383b55;
  --destructive: #f87171;
  --destructive-foreground: #0b0c12;
  --foreground: #e4e5ee;
  --input: #23253a;
  --muted: #1f2026;
  --muted-foreground: #83869a;
  --popover: #151722;
  --popover-foreground: #e4e5ee;
  --primary: #b8b2ff;
  --primary-foreground: #12112a;
  --radius: 6px;
  --ring: #b8b2ff;
  --secondary: #1f2026;
  --secondary-foreground: #e4e5ee;
  --sidebar: #151722;
  --sidebar-accent: #1f2026;
  --sidebar-accent-foreground: #e4e5ee;
  --sidebar-border: #23253a;
  --sidebar-foreground: #e4e5ee;
  --sidebar-primary: #b8b2ff;
  --sidebar-primary-foreground: #12112a;
  --sidebar-ring: #b8b2ff;
}

[data-flavor-scheme="vellum"] {
  --accent: #dcd6cd;
  --accent-foreground: #1d1a15;
  --background: #efe9df;
  --border: #d6cdbd;
  --card: #e5ddd0;
  --card-foreground: #1d1a15;
  --chart-1: #a8741f;
  --chart-2: #1d1a15;
  --chart-3: #6f685c;
  --chart-4: #4a443a;
  --chart-5: #b9ae9a;
  --destructive: #dc2626;
  --destructive-foreground: #fbf6ec;
  --foreground: #1d1a15;
  --input: #d6cdbd;
  --muted: #dcd6cd;
  --muted-foreground: #605c55;
  --popover: #e5ddd0;
  --popover-foreground: #1d1a15;
  --primary: #a8741f;
  --primary-foreground: #fbf6ec;
  --radius: 6px;
  --ring: #a8741f;
  --secondary: #dcd6cd;
  --secondary-foreground: #1d1a15;
  --sidebar: #e5ddd0;
  --sidebar-accent: #dcd6cd;
  --sidebar-accent-foreground: #1d1a15;
  --sidebar-border: #d6cdbd;
  --sidebar-foreground: #1d1a15;
  --sidebar-primary: #a8741f;
  --sidebar-primary-foreground: #fbf6ec;
  --sidebar-ring: #a8741f;
}

@theme inline {
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-background: var(--background);
  --color-border: var(--border);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-foreground: var(--foreground);
  --color-input: var(--input);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-ring: var(--ring);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-sidebar: var(--sidebar);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-ring: var(--sidebar-ring);
  --font-display: "Inter", ui-sans-serif, system-ui, -apple-system, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;
  --font-sans: "Inter", ui-sans-serif, system-ui, -apple-system, sans-serif;
  --radius-lg: var(--radius);
  --radius-md: max(0px, calc(var(--radius) - 2px));
  --radius-sm: max(0px, calc(var(--radius) - 4px));
  --radius-xl: calc(var(--radius) + 4px);
}
```

### Schemes

- The flavor is dark-native: `:root` and `.dark` carry the same palette, so the theme reads the same with or without a `dark` class.
- Extra palettes are opt-in: set `data-flavor-scheme="<slug>"` on `<html>` or any subtree. Available: `ember` (Ember), `verdigris` (Verdigris), `moonlit` (Moonlit), `vellum` (Vellum).

### Token mapping

Every surface/foreground pair below was checked for WCAG contrast (4.5:1 for text, 3:1 as the floor on the primary button); when a flavor token would fail, the value is derived from `bg` and `fg` instead.

| Flavor token | shadcn variable |
| --- | --- |
| bg | `--background` |
| fg | `--foreground`, first choice for every `--*-foreground` |
| bg2 | `--card`, `--popover`, `--sidebar` when it sits on the same side as `bg` and reads with `fg`; otherwise `--surface-inverse`, and the card becomes `bg` tinted 6% toward `fg` |
| bg + fg (9%) | `--secondary`, `--muted`, `--accent` (shadcn's hover surface, not the flavor accent) |
| fg-muted | `--muted-foreground` (pulled toward `fg` until it reads) |
| accent | `--primary`, `--ring`, `--chart-1` |
| accent-fg | `--primary-foreground` |
| border | `--border`, `--input`, `--sidebar-border` (derived from `bg`/`fg` when the token is a `var()`, `color-mix()` or invisible against `bg`) |
| extra.* | `--destructive` (a key named danger/error/red/alert), `--chart-2..5` |
| radius | `--radius`; `--radius-sm/md` never go below 0 |

### Component recipes

- **Button:** use `bg-primary text-primary-foreground rounded-[var(--radius)]`; headings can use `font-display` ("Inter", ui-sans-serif, system-ui, -apple-system, sans-serif).
- **Card:** use `bg-card text-card-foreground border border-border rounded-[var(--radius)]`; see Components above for the flavor's shadow treatment.
- **Input:** use `bg-background border border-input rounded-[var(--radius)]`; keep the border treatment from Components above.
- **Badge:** use `bg-secondary text-secondary-foreground rounded-[var(--radius)]`; follow the flavor's density and typography rules above.
- **Tabs:** use `border-b border-border` with active `text-primary`; see Components above for spacing and interaction details.

### Implementation rule for agents

Import primitives from `@/components/ui/*`, apply the theme CSS first, and keep this flavor's Components, Do's, and Don'ts as the source of truth. shadcn names are only the implementation surface.
