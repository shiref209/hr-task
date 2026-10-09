import { useState } from 'react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Pagination,
  SelectInput,
  Skeleton,
  TextInput,
  ToastProvider,
  useToast,
} from '..';
import './design-system-preview.scss';

const swatches = [
  'primary',
  'secondary',
  'accent',
  'text',
  'text-muted',
  'background',
  'surface',
  'border',
  'danger',
  'success',
  'warning',
];
const darkSwatches = new Set([
  'primary',
  'secondary',
  'text',
  'text-muted',
  'danger',
  'success',
  'warning',
]);
const sizes = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'];
const roles = [
  { value: 'hr', label: 'HR' },
  { value: 'employee', label: 'Employee' },
];

function ToastButtons() {
  const { show } = useToast();
  return (
    <>
      {(['success', 'error', 'info', 'warning'] as const).map((variant) => (
        <Button
          key={variant}
          variant="secondary"
          size="sm"
          onClick={() =>
            show({
              variant,
              title: `${variant} toast`,
              description: 'Example description',
            })
          }
        >
          {variant}
        </Button>
      ))}
    </>
  );
}

export function DesignSystemPreview() {
  const [page, setPage] = useState(2);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <ToastProvider>
      <main className="ds-preview">
        <h1>Design system</h1>

        <Card title="Colors">
          <div className="ds-preview__row">
            {swatches.map((name) => (
              <span
                key={name}
                className={
                  darkSwatches.has(name)
                    ? 'ds-preview__swatch ds-preview__swatch--dark'
                    : 'ds-preview__swatch'
                }
                style={{ background: `var(--color-${name})` }}
              >
                {name}
              </span>
            ))}
          </div>
        </Card>

        <Card title="Type scale">
          {sizes.map((size) => (
            <p key={size} style={{ fontSize: `var(--font-size-${size})` }}>
              {size}: The quick brown fox
            </p>
          ))}
        </Card>

        <Card title="Buttons">
          <div className="ds-preview__row">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button size="sm">Small</Button>
            <Button isLoading>Loading</Button>
            <Button disabled>Disabled</Button>
          </div>
        </Card>

        <Card title="Inputs">
          <TextInput label="Name" hint="As on the contract" required />
          <TextInput
            label="Email"
            error="Enter a valid email"
            defaultValue="nope"
          />
          <SelectInput
            label="Role"
            options={roles}
            placeholder="Choose a role"
          />
        </Card>

        <Card title="Badges and avatars">
          <div className="ds-preview__row">
            <Badge>Neutral</Badge>
            <Badge tone="success">Active</Badge>
            <Badge tone="danger">Inactive</Badge>
            <Badge tone="warning">Pending</Badge>
            <Badge tone="info">HR</Badge>
            <Avatar name="Mona Ali Hassan" size="sm" />
            <Avatar name="Omar Said" />
            <Avatar name="Layla" size="lg" />
            <Avatar name="" />
          </div>
        </Card>

        <Card title="Skeleton">
          <div className="ds-preview__row" aria-busy="true">
            <Skeleton variant="circle" />
            <Skeleton variant="text" lines={3} />
          </div>
        </Card>

        <Card title="Toasts, dialog, pagination" footer="Dev-only page">
          <div className="ds-preview__row">
            <ToastButtons />
            <Button
              variant="danger"
              size="sm"
              onClick={() => setDialogOpen(true)}
            >
              Open dialog
            </Button>
          </div>
          <Pagination page={page} totalPages={5} onPageChange={setPage} />
        </Card>

        <Card title="Empty state">
          <EmptyState
            title="No employees match this search"
            description="Try a different name."
            action={<Button variant="secondary">Clear search</Button>}
          />
        </Card>

        <ConfirmDialog
          open={dialogOpen}
          title="Delete employee?"
          description="This cannot be undone."
          confirmLabel="Delete"
          tone="danger"
          onConfirm={() => setDialogOpen(false)}
          onCancel={() => setDialogOpen(false)}
        />
      </main>
    </ToastProvider>
  );
}
