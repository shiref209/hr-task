import type { Employee } from '@hr/types';
import { Menu } from '../../../shared/ui';

interface EmployeeRowActionsProps {
  employee: Employee;
  onRestore: (employee: Employee) => void;
  onEdit: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
}

export function EmployeeRowActions({ employee, onRestore, onEdit, onDelete }: EmployeeRowActionsProps) {
  const items = employee.deletedAt
    ? [{ label: 'Restore', onSelect: () => onRestore(employee) }]
    : [
        { label: 'Edit', onSelect: () => onEdit(employee) },
        { label: 'Delete', tone: 'danger' as const, onSelect: () => onDelete(employee) },
      ];
  return <Menu label={`Actions for ${employee.fullName}`} items={items} />;
}
