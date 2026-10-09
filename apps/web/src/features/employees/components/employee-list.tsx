import type { Employee } from '@hr/types';
import { formatAmount } from '../../../shared/format/format-amount';
import { formatDate } from '../../../shared/format/format-date';
import { resolveAssetUrl } from '../../../shared/http/http-client';
import { Avatar, Badge } from '../../../shared/ui';
import { EmployeeRowActions } from './employee-row-actions';
import { EmployeeStatusBadge } from './employee-status-badge';

interface EmployeeListProps {
  employees: Employee[];
  busy: boolean;
  onRestore: (employee: Employee) => void;
  onEdit: (employee: Employee) => void;
  onPayslip: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
}

// Explicit roles keep table semantics when the mobile styles turn rows into cards (display: block).
export function EmployeeList({ employees, busy, onRestore, onEdit, onPayslip, onDelete }: EmployeeListProps) {
  return (
    <table className="employee-list" aria-busy={busy}>
      <caption className="visually-hidden">Employees</caption>
      <thead role="rowgroup" className="employee-list__head">
        <tr role="row">
          <th role="columnheader" scope="col">Name</th>
          <th role="columnheader" scope="col">Department</th>
          <th role="columnheader" scope="col">Job title</th>
          <th role="columnheader" scope="col">Salary</th>
          <th role="columnheader" scope="col">Status</th>
          <th role="columnheader" scope="col">Actions</th>
        </tr>
      </thead>
      <tbody role="rowgroup">
        {employees.map((employee) => (
          <tr key={employee.id} role="row" className="employee-list__row" data-employee-id={employee.id}>
            <td role="cell" className="employee-list__cell employee-list__cell--name">
              <div className="employee-list__person">
              <Avatar name={employee.fullName} src={resolveAssetUrl(employee.profileImageUrl)} />
              <div className="employee-list__identity">
                <span className="employee-list__name">
                  {employee.fullName}
                  {employee.type === 'HR' ? <Badge tone="info">HR</Badge> : null}
                </span>
                <span className="employee-list__email">{employee.email}</span>
                {employee.deletedAt ? (
                  <span className="employee-list__deleted">
                    Deleted on {formatDate(employee.deletedAt)}
                  </span>
                ) : null}
              </div>
              </div>
            </td>
            <td role="cell" className="employee-list__cell employee-list__cell--department">{employee.department.name}</td>
            <td role="cell" className="employee-list__cell employee-list__cell--job">{employee.jobTitle}</td>
            <td role="cell" className="employee-list__cell employee-list__cell--amount">
              {formatAmount(employee.baseSalary)}
            </td>
            <td role="cell" className="employee-list__cell employee-list__cell--status">
              <EmployeeStatusBadge status={employee.status} />
            </td>
            <td role="cell" className="employee-list__cell employee-list__cell--actions">
              <EmployeeRowActions employee={employee} onRestore={onRestore} onEdit={onEdit} onPayslip={onPayslip} onDelete={onDelete} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
