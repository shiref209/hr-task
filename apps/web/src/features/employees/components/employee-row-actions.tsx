import type { Employee } from '@hr/types';
import { Menu } from '../../../shared/ui';

interface EmployeeRowActionsProps {
  employee: Employee;
  onRestore: (employee: Employee) => void;
  onEdit: (employee: Employee) => void;
}

// Delete arrives with its own deep-dive.
export function EmployeeRowActions({ employee, onRestore, onEdit }: EmployeeRowActionsProps) {
  const item = employee.deletedAt
    ? { label: 'Restore', onSelect: () => onRestore(employee) }
    : { label: 'Edit', onSelect: () => onEdit(employee) };
  return <Menu label={`Actions for ${employee.fullName}`} items={[item]} />;
}
