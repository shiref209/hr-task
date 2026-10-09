import { createEmployeeSchema, localToday, updateEmployeeSchema, type Department } from '@hr/types';
import { useEffect, useState } from 'react';
import { useForm, useWatch, type Path } from 'react-hook-form';
import { FormAlert, SelectInput, TextInput } from '../../../shared/ui';
import type { ServerFormErrors } from '../../../shared/forms/api-error-to-form';
import { displayAmount, normalizeSalary } from '../../../shared/forms/salary';
import { schemaResolver } from '../../../shared/forms/schema-resolver';
import { useFormatOnBlur } from '../../../shared/forms/use-format-on-blur';
import { useServerFormErrors } from '../../../shared/forms/use-server-form-errors';
import { changedFields, emptyFormValues, type EmployeeFormValues } from '../form/form-values';

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
  // The salary is normalized first because the schemas only know the API format.
  const [resolver] = useState(() =>
    schemaResolver<EmployeeFormValues>(
      mode === 'create' ? createEmployeeSchema : updateEmployeeSchema,
      (values) => ({ ...values, baseSalary: normalizeSalary(values.baseSalary) }),
    ),
  );
  const form = useForm<EmployeeFormValues>({
    defaultValues: { ...initial, baseSalary: displayAmount(initial.baseSalary) },
    resolver,
    mode: 'onBlur',
  });
  const { register, control, handleSubmit, setError, setFocus, getValues, formState: { errors } } = form;
  const formatOnBlur = useFormatOnBlur(form);
  const { formError, withServerErrors } = useServerFormErrors(setError, isFormField);

  useWatch({ control }); // re-renders on every edit so `dirty` below stays current
  const dirty = Object.keys(changedFields(initial, getValues())).length > 0;
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
  useEffect(() => setFocus('fullName'), [setFocus]);

  const submit = handleSubmit(async (values) => {
    if (isSaving) return;
    await withServerErrors(() => onSubmit(values));
  });

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
        onBlurCapture={formatOnBlur('baseSalary')}
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
      <FormAlert message={formError} />
    </form>
  );
}
