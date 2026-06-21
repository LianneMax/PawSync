---
name: mobile-view-optimizer
description: Optimize PawSync frontend pages/components for mobile sm (≥640px) and md (≥768px) Tailwind breakpoints. Use when asked to make a page/component "responsive", "mobile-friendly", fix layout on small screens, or review/fix sm:/md: classes in frontend/app or frontend/components.
---

# Mobile view optimizer (sm/md)

Optimize a given page or component in `frontend/app/**` or `frontend/components/**` for small screens, using PawSync's default Tailwind v4 breakpoints (no custom overrides in `frontend/tailwind.config.ts`):

- Base styles = mobile (<640px), the default/unprefixed classes.
- `sm:` ≥640px
- `md:` ≥768px

## Process

1. Read the target file(s) fully before editing — note existing layout primitives (flex/grid, `components/ui` primitives like Card/Dialog/Sheet, kokonutui components).
2. Identify breakpoints issues:
   - Fixed widths/heights that overflow on narrow viewports (`w-[..px]`, large `gap-`/`p-` values without a mobile override).
   - Multi-column grids/flex-rows that don't collapse to a single column below `md:`.
   - Tables or wide data displays with no horizontal scroll wrapper or mobile-card fallback.
   - Text sizes/line-lengths too large for sm screens.
   - Touch targets (buttons/icons) smaller than ~40px on mobile.
   - Modals/Dialogs/Sheets that don't fill the viewport appropriately on mobile.
   - Text alignment inconsistencies: related text (labels with their values, list/card items, headers within the same group) not sharing the same `text-left`/`text-center`/`text-right`, or not vertically aligned within a flex/grid row (`items-center`, `items-baseline`).
   - Any container, `div`, or `section` that can overflow its parent or the viewport at sm/md widths — missing `max-w-full`/`min-w-0` on flex children, missing `overflow-x-auto`/`overflow-hidden` where content can exceed bounds, images/icons without `max-w-full` or a constrained size.
   - `useEffect` driving responsive/layout behavior (e.g. `window.innerWidth` checks, resize listeners, mounting-dependent layout toggles) — this must be replaced with pure Tailwind `sm:`/`md:` classes, never with JS viewport detection.
   - Anything slowing first paint on mobile: unnecessary client components, render-blocking effects, unoptimized images, or non-critical content loaded eagerly instead of deferred.
3. Fix mobile-first: write the base (no prefix) class for the mobile layout, then add `sm:`/`md:` overrides for larger layouts — don't do it backwards (don't default to desktop and override down).
4. Keep existing component structure and props; only change className/layout, unless the fix genuinely requires structural changes (e.g., wrapping a table in `overflow-x-auto`, or swapping a grid to a flex column on mobile).
5. After edits, summarize what breakpoint behavior changed, file:line referenced.

## Conventions to follow

- Reuse existing primitives in `frontend/components/ui` rather than inventing new layout patterns.
- Use Tailwind's standard spacing/sizing scale; avoid arbitrary pixel values unless already used nearby.
- Don't introduce a `lg:`/`xl:` strategy unless asked — scope is sm/md only.
- No container, div, or section should overflow its parent or the device viewport at sm/md widths — this is a hard requirement, not just a nice-to-have.
- Text elements that belong together (label/value pairs, table cell groups, card titles/subtitles) must share consistent alignment with each other.

## Performance constraints (hard requirements)

- Never use `useEffect` to implement responsive/mobile behavior. CSS (Tailwind `sm:`/`md:`) handles breakpoints natively with no JS, no flash-of-wrong-layout, and no extra render. If an existing `useEffect` exists only to detect viewport size or toggle layout, remove it and replace with responsive classes.
- `useEffect` for non-layout concerns (data fetching, subscriptions) is out of scope for this skill — don't touch it unless it's also causing a layout/perf issue being fixed.
- Optimize for fast mobile page load: prefer Server Components over Client Components when no interactivity is needed; lazy-load below-the-fold or non-critical components with `next/dynamic`; use `next/image` with correct `sizes`/`priority` (only above-the-fold images get `priority`); avoid adding client-side state or effects that delay first paint.
