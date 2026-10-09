# Design system (web)

[← Docs index](README.md) · spec: [`specs/design-system/spec.md`](../specs/design-system/spec.md)

A small, themed set of UI primitives in `apps/web/src/shared/ui/` so every screen is built from the same parts. No UI kit: the brief asks for plain CSS/SCSS.

## Preview page — development only
**http://localhost:5173/design-system** (with `pnpm dev` running)

It shows every token and component state: colours, type scale, button variants, inputs with hint/error, badges, avatars, skeletons, toasts, the confirm dialog, pagination and the empty state. `App.tsx` renders it only when `import.meta.env.DEV` is true, so it is stripped from production builds.

## Rules
- **Tokens only.** Colours, font sizes, spacing, radii, shadows and motion are CSS custom properties in `shared/theme/`. No hex or px values in feature styles.
- **Mobile first.** `min-width` breakpoints via the SCSS mixin `@include up(md)` (`sm 640px`, `md 768px`, `lg 1024px`).
- **Flexbox + `gap`**, no fixed container widths or heights.
- **BEM** class names, styles colocated with the component (`<name>.tsx`, `<name>.scss`, `<name>.test.tsx`).
- **Accessible by default:** labels always rendered, `aria-invalid` / `aria-describedby` on fields, native `<dialog>` for focus trapping, motion off under `prefers-reduced-motion`.

## Tokens
| Group | Examples |
|---|---|
| Brand | `--color-primary` (#0d21a1), `--color-secondary`, `--color-accent` |
| Neutral | `--color-text`, `--color-text-muted`, `--color-background`, `--color-surface`, `--color-border` |
| Status | `--color-danger`, `--color-success`, `--color-warning`, each with `-subtle` |
| Type | Inter (self-hosted), `--font-size-xs…2xl`, `--font-weight-*`, `--line-height-*` |
| Space | `--space-1` (0.25rem) … `--space-8` (3rem) |
| Shape / motion / layers | `--radius-*`, `--shadow-*`, `--duration-*`, `--z-toast`, `--z-dialog` |

```scss
.employee-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-surface);

  @include up(md) {
    flex-direction: row;
  }
}
```

## Components
| Component | Key props |
|---|---|
| `Button` | `variant: primary \| secondary \| ghost \| danger`, `size: sm \| md`, `isLoading`, `fullWidth` |
| `TextInput` / `SelectInput` | `label`, `hint?`, `error?` (ref-forwarding for react-hook-form) |
| `Toast` | `ToastProvider` + `useToast().show({ variant, title, description? })` |
| `Skeleton` | `variant: text \| circle \| rect`, `lines?` |
| `Card` | `title?`, `actions?`, `footer?` |
| `Avatar` | `name`, `src?`, `size` — falls back to initials |
| `Badge` | `tone: neutral \| success \| danger \| warning \| info` |
| `ConfirmDialog` | `open`, `title`, `description`, `confirmLabel`, `tone`, `isConfirming`, `onConfirm`, `onCancel` |
| `Pagination` | `page`, `totalPages`, `onPageChange` |
| `EmptyState` | `title`, `description?`, `action?` |
| `ErrorView` | `error`, `onRetry` — renders Problem Details title/detail |
| `Drawer`, `Menu`, `Tabs`, `Field` | side panel, row action menu, tabbed sections, field wrapper |

Everything is exported from `shared/ui/index.ts`.

## Examples
```tsx
import { Button, TextInput, Badge, Avatar, EmptyState, useToast } from '../../shared/ui';

<Button variant="danger" isLoading={isDeleting} onClick={onDelete}>Delete</Button>

<TextInput label="Email" hint="Work email" error={errors.email?.message} {...register('email')} />

<Badge tone="success">Active</Badge>
<Avatar name="Mona Ali Hassan" size="sm" />          {/* → "MH" when there is no photo */}

<EmptyState
  title="No employees match this search"
  description="Try a different name."
  action={<Button variant="secondary" onClick={clearSearch}>Clear search</Button>}
/>

const toast = useToast();
toast.show({ variant: 'success', title: 'Employee saved' });
```

## Behaviour worth knowing
- `Button` with `isLoading` is disabled, sets `aria-busy` and ignores clicks.
- `TextInput` with both `hint` and `error` shows the error and points `aria-describedby` at it.
- Toasts: success/info auto-dismiss after 5 s, errors stay until dismissed; max 3 visible (oldest dropped).
- `ConfirmDialog`: Esc or Cancel never confirms; focus returns to the button that opened it.
- `Pagination` hides itself when there is only one page.

Each behaviour above has a Vitest + Testing Library test next to the component.
