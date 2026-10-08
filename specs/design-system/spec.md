# Spec: Design System (web)

Status: **decisions recorded — awaiting edge-case sign-off**

## Objective
A small, themed set of reusable UI primitives so every feature screen is built from the same parts, with **no hard-coded colors, font sizes, font colors or spacing** anywhere outside the theme. Mobile first, flexbox, accessible.

## Theme (`apps/web/src/shared/theme/`)
Tokens are **CSS custom properties** on `:root` (runtime-themable; dark mode later = one `[data-theme="dark"]` block). SCSS is used only for the breakpoint mixin and BEM nesting.

| Group | Tokens |
|---|---|
| Brand | `--color-primary #0d21a1`, `--color-primary-ink #fff`, `--color-secondary #011638`, `--color-accent #eec643`, `--color-accent-ink #141414` |
| Neutral | `--color-text #141414`, `--color-text-muted`, `--color-background #eef0f2`, `--color-surface #fff`, `--color-border` |
| Status (AA on white) | `--color-danger`, `--color-success`, `--color-warning` (= accent), each with a `-subtle` background |
| Type | Inter (`@fontsource-variable/inter`), `--font-size-xs…2xl` (rem), `--font-weight-regular/medium/semibold/bold`, `--line-height-tight/normal` |
| Space | 4px-based scale in rem: `--space-1` (0.25rem) … `--space-8` (3rem) |
| Shape | `--radius-sm/md/lg/full`, `--shadow-sm/md`, `--border-width` |
| Size | `--size-avatar-sm/md/lg`, `--size-icon` (intrinsic media only) |
| Motion | `--duration-fast/normal`; disabled under `prefers-reduced-motion` |
| Layers | `--z-toast`, `--z-dialog` |
| Breakpoints (SCSS) | `sm 640px`, `md 768px`, `lg 1024px` via `@include up(md)` (min-width only) |

Light theme only for now.

## Components (`apps/web/src/shared/ui/<name>/`: `<name>.tsx`, `<name>.scss`, `<name>.test.tsx`)
| Component | API (props) | Notes |
|---|---|---|
| Button | `variant: primary\|secondary\|ghost\|danger`, `size: sm\|md`, `isLoading`, `fullWidth`, native button props | `type="button"` by default; loading = disabled + `aria-busy` + spinner |
| TextInput | `label`, `hint?`, `error?`, native input props | label always rendered; `aria-invalid` + `aria-describedby` → hint/error; required marker; ref-forwarding for react-hook-form |
| SelectInput | `label`, `options: {value,label}[]`, `placeholder?`, `hint?`, `error?` | native `<select>`; same a11y wiring as TextInput |
| Toast | `ToastProvider` + `useToast().show({ variant, title, description? })` | `success\|error\|info\|warning`; auto-dismiss 5s (errors stay until dismissed); `aria-live` polite, `assertive` for errors; dismiss button; max 3 visible |
| Skeleton | `variant: text\|circle\|rect`, `lines?` | `aria-hidden`; parent region sets `aria-busy`; shimmer off for reduced motion |
| Card | `title?`, `actions?`, `children`, `footer?` | semantic `<section>` with heading when titled |
| Avatar | `name`, `src?`, `size: sm\|md\|lg` | falls back to initials when no `src` **or** image fails to load; `alt` = name |
| Badge | `tone: neutral\|success\|danger\|warning\|info`, `children` | status (Active/Inactive) and type (HR/Employee) pills |
| ConfirmDialog | `open`, `title`, `description`, `confirmLabel`, `tone`, `isConfirming`, `onConfirm`, `onCancel` | native `<dialog>` (`showModal`): focus trap + Esc for free; focus returns to the trigger |
| Pagination | `page`, `totalPages`, `onPageChange` | `<nav aria-label>`; prev/next disabled at the ends; current page `aria-current="page"`; hidden when `totalPages ≤ 1` |
| EmptyState | `title`, `description?`, `action?` | used for empty lists and no-results searches |

Dev-only preview: `/design-system` page (rendered only when `import.meta.env.DEV`) shows tokens and every component state.

## Testing strategy
Vitest + Testing Library (jsdom) + user-event. Behaviour, not styling: roles/labels, a11y attributes, loading/disabled, toast timing (fake timers), avatar fallback on `error` event.

## New dependencies (to justify in README)
`sass` (SCSS), `@fontsource-variable/inter` (self-hosted font), `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`.

## Edge cases (proposed — confirm)
1. Avatar initials: first letter of first + last word (`"Mona Ali Hassan"` → `MH`); single word → one letter; empty/whitespace name → generic placeholder icon.
2. Button clicked while `isLoading` → handler not called.
3. TextInput with both `hint` and `error` → error replaces hint (`aria-describedby` points to the error).
4. Toast: 4th toast while 3 visible → oldest is dropped. Same message shown twice → two toasts (no dedupe).
5. Skeleton with `lines=3` → last line shorter (visual), still one `aria-hidden` group.
6. ConfirmDialog: Esc or Cancel → `onCancel`, never `onConfirm`; confirm button disabled + loading while `isConfirming`; focus returns to the opener on close.
7. Pagination: page 1 → Previous disabled; last page → Next disabled; `totalPages` 0 or 1 → renders nothing.

## Boundaries
- Always: tokens only; mobile-first `min-width` queries; flex + `gap`; no fixed container width/height.
- Ask first: new primitive beyond this list, any new dependency.
- Never: inline hex/px values in feature styles; UI kit libraries.

## Success criteria
- `grep` for hex colors / `px` font sizes outside `shared/theme` returns nothing.
- All component tests pass; each component usable by keyboard and screen reader.
