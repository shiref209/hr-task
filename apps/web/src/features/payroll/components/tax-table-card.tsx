import type { TaxTable } from '@hr/types';
import { useId } from 'react';
import { Badge, Menu } from '../../../shared/ui';
import { TaxBracketList } from './tax-bracket-list';

interface TaxTableCardProps {
  table: TaxTable;
  onEdit: (table: TaxTable) => void;
  onSetDefault: (table: TaxTable) => void;
  onDelete: (table: TaxTable) => void;
}

export function TaxTableCard({ table, onEdit, onSetDefault, onDelete }: TaxTableCardProps) {
  const headingId = useId();
  const items = table.isDefault
    ? [{ label: 'Edit', onSelect: () => onEdit(table) }]
    : [
        { label: 'Edit', onSelect: () => onEdit(table) },
        { label: 'Set as default', onSelect: () => onSetDefault(table) },
        { label: 'Delete', tone: 'danger' as const, onSelect: () => onDelete(table) },
      ];
  const count = table.employeeCount;

  return (
    <article className="tax-table-card" aria-labelledby={headingId}>
      <header className="tax-table-card__header">
        <h2 id={headingId} className="tax-table-card__title">
          {table.name}
        </h2>
        {table.isDefault ? <Badge tone="info">Default</Badge> : null}
        <div className="tax-table-card__menu">
          <Menu label={`Actions for ${table.name}`} items={items} />
        </div>
      </header>
      <TaxBracketList brackets={table.brackets} />
      <p className="tax-table-card__usage">
        Used by {count} {count === 1 ? 'employee' : 'employees'}
      </p>
    </article>
  );
}
