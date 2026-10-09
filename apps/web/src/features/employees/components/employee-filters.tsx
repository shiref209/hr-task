import { employeeStatusSchema, type Department } from '@hr/types';
import { SelectInput, TextInput } from '../../../shared/ui';
import type { EmployeeListState } from '../list-state';

interface EmployeeFiltersProps {
  state: EmployeeListState;
  departments: Department[];
  departmentsFailed: boolean;
  canShowDeleted: boolean;
  onChange: (changes: Partial<EmployeeListState>) => void;
}

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

export function EmployeeFilters({
  state,
  departments,
  departmentsFailed,
  canShowDeleted,
  onChange,
}: EmployeeFiltersProps) {
  return (
    <div className="employee-filters">
      <TextInput
        label="Search name or email"
        maxLength={100}
        value={state.search}
        onChange={(event) => onChange({ search: event.target.value })}
      />
      <SelectInput
        label="Department"
        // Message goes in the placeholder, not a hint: a hint line would push this control out of line with the other filters.
        placeholder={departmentsFailed ? 'Departments could not be loaded' : 'All departments'}
        options={departments.map(({ id, name }) => ({ value: id, label: name }))}
        value={state.departmentId ?? ''}
        disabled={departmentsFailed}
        onChange={(event) => onChange({ departmentId: event.target.value || undefined })}
      />
      <SelectInput
        label="Status"
        placeholder="All statuses"
        options={STATUS_OPTIONS}
        value={state.status ?? ''}
        onChange={(event) =>
          onChange({ status: employeeStatusSchema.safeParse(event.target.value).data })
        }
      />
      {canShowDeleted ? (
        <label className="employee-filters__toggle">
          <input
            type="checkbox"
            checked={state.deleted}
            onChange={(event) => onChange({ deleted: event.target.checked })}
          />
          Show deleted
        </label>
      ) : null}
    </div>
  );
}
