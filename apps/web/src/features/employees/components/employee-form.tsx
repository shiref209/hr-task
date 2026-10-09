import { localToday, type Department } from '@hr/types';
import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch, type Path } from 'react-hook-form';
import { formatAmount } from '../../../shared/format/format-amount';
import { SelectInput, TextInput } from '../../../shared/ui';
import type { ServerFormErrors } from '../form/api-error-to-form';
import { employeeResolver } from '../form/employee-resolver';
import { changedFields, emptyFormValues, type EmployeeFormValues } from '../form/form-values';
import { parseSalary } from '../form/salary';

interface EmployeeFormProps {
  id: string;
  mode: 'create' | 'edit';
  initial: EmployeeFormValues;
  departments: Department[];
  isSaving: boolean;
  onSubmit: (values: EmployeeFormValues) => Promise<ServerFormErrors | undefined>;
  onDirtyChange: (dirty: boolean) => void;
}

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];
const TYPE_OPTIONS = [
  { value: 'EMPLOYEE', label: 'Employee' },
  { value: 'HR', label: 'HR' },
];

const isFormField = (name: string): name is Path<EmployeeFormValues> => name in emptyFormValues;

export function EmployeeForm({
  id,
  mode,
  initial,
  departments,
  isSaving,
  onSubmit,
  onDirtyChange,
}: EmployeeFormProps) {
  const [formError, setFormError] = useState<string>();
  const alertRef = useRef<HTMLParagraphElement>(null);
  const [resolver] = useState(() => employeeResolver(mode));
  const {
    register,
    control,
    handleSubmit,
    setError,
    setFocus,
    setValue,
    getValues,
    trigger,
    formState: { errors },
  } = useForm<EmployeeFormValues>({
    defaultValues: {
      ...initial,
      baseSalary: parseSalary(initial.baseSalary) ? formatAmount(initial.baseSalary) : initial.baseSalary,
    },
    resolver,
    mode: 'onBlur',
  });

  useWatch({ control }); // re-renders on every edit so `dirty` below stays current
  const dirty = Object.keys(changedFields(initial, getValues())).length > 0;
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
  useEffect(() => setFocus('fullName'), [setFocus]);
  useEffect(() => alertRef.current?.focus(), [formError]);

  const submit = handleSubmit(async (values) => {
    if (isSaving) return;
    setFormError(undefined);
    const failure = await onSubmit(values);
    if (!failure) return;
    for (const [name, message] of Object.entries(failure.fieldErrors)) {
      if (isFormField(name)) setError(name, { type: 'server', message }, { shouldFocus: true });
    }
    setFormError(failure.formError);
  });

  const formatSalary = async () => {
    if (!(await trigger('baseSalary'))) return;
    const normalized = parseSalary(getValues('baseSalary'));
    if (normalized) setValue('baseSalary', formatAmount(normalized));
  };

  return (
    <form id={id} className="employee-form" onSubmit={submit} noValidate>
      <TextInput label="Full name" required error={errors.fullName?.message} {...register('fullName')} />
      <TextInput label="Email" type="email" required error={errors.email?.message} {...register('email')} />
      <TextInput
        label="Base salary"
        inputMode="decimal"
        required
        error={errors.baseSalary?.message}
        {...register('baseSalary')}
        // Capture phase: the registered onBlur prop stays free for react-hook-form's own validation.
        onBlurCapture={formatSalary}
      />
      <TextInput label="Job title" required error={errors.jobTitle?.message} {...register('jobTitle')} />
      <SelectInput
        label="Department"
        required
        placeholder="Select a department"
        options={departments.map(({ id: value, name }) => ({ value, label: name }))}
        error={errors.departmentId?.message}
        {...register('departmentId')}
      />
      <TextInput
        label="Hire date"
        type="date"
        max={localToday()}
        required
        error={errors.hireDate?.message}
        {...register('hireDate')}
      />
      <TextInput label="Phone" type="tel" error={errors.phone?.message} {...register('phone')} />
      <SelectInput label="Status" options={STATUS_OPTIONS} {...register('status')} />
      <SelectInput label="Type" options={TYPE_OPTIONS} {...register('type')} />
      {formError ? (
        <p ref={alertRef} className="employee-form__alert" role="alert" tabIndex={-1}>
          {formError}
        </p>
      ) : null}
    </form>
  );
}
