import type { Employee } from '@hr/types';
import { Menu } from '../../../shared/ui';

interface EmployeeRowActionsProps {
  employee: Employee;
  onRestore: (employee: Employee) => void;
}

// Edit and Delete arrive with the form and delete deep-dives; until then only deleted rows have actions.
export function EmployeeRowActions({ employee, onRestore }: EmployeeRowActionsProps) {
  if (!employee.deletedAt) return null;
  return (
    <Menu
      label={`Actions for ${employee.fullName}`}
      items={[{ label: 'Restore', onSelect: () => onRestore(employee) }]}
    />
  );
}
