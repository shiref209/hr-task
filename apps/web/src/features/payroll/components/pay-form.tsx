import { payItemsSchema, type Employee, type PayItems, type TaxTable } from '@hr/types';
import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toApiError } from '../../../shared/http/http-client';
import { Button, SelectInput, useToast } from '../../../shared/ui';
import { useUpdateEmployee } from '../../employees/api/use-update-employee';
import { useReplacePayItems } from '../api/use-pay-items';
import { toFormValues, toItems, type PayFormValues } from '../form/pay-values';
import { schemaResolver } from '../form/schema-resolver';
import { PayItemsEditor } from './pay-items-editor';
import '../payroll.scss';

interface PayFormProps {
  employee: Employee;
  tables: TaxTable[];
  items: PayItems;
  onDirtyChange: (dirty: boolean) => void;
  onSaved: () => void;
}

const resolver = schemaResolver<PayFormValues>(payItemsSchema, toItems);

export function PayForm({ employee, tables, items, onDirtyChange, onSaved }: PayFormProps) {
  const toast = useToast();
  const updateEmployee = useUpdateEmployee();
  const replaceItems = useReplacePayItems(employee.id);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string>();
  const alertRef = useRef<HTMLParagraphElement>(null);
  const [initial] = useState(() => toFormValues(employee.taxTable?.id ?? null, items));
  // What the server holds now. A part that saved stays here, so a retry sends only the part that failed.
  const [saved, setSaved] = useState({ taxTableId: initial.taxTableId, items: toItems(initial) });

  const form = useForm<PayFormValues>({ defaultValues: initial, resolver, mode: 'onBlur' });
  const { register, control, handleSubmit, getValues } = form;

  useWatch({ control }); // keeps `dirty` below current on every edit
  const current = getValues();
  const taxChanged = current.taxTableId !== saved.taxTableId;
  const itemsChanged = JSON.stringify(toItems(current)) !== JSON.stringify(saved.items);
  const dirty = taxChanged || itemsChanged;
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
  useEffect(() => alertRef.current?.focus(), [formError]);

  const defaultTable = tables.find((table) => table.isDefault);
  const options = [
    { value: '', label: defaultTable ? `Default (${defaultTable.name})` : 'Default' },
    ...tables.map(({ id, name }) => ({ value: id, label: name })),
  ];

  const submit = handleSubmit(async (values) => {
    if (isSaving) return;
    setIsSaving(true);
    setFormError(undefined);
    let failure: string | undefined;
    const fail = (cause: unknown) => {
      const { problem } = toApiError(cause);
      failure ??= problem.detail ?? problem.title;
    };

    if (values.taxTableId !== saved.taxTableId) {
      try {
        await updateEmployee.mutateAsync({
          id: employee.id,
          changes: { taxTableId: values.taxTableId === '' ? null : values.taxTableId },
        });
        setSaved((previous) => ({ ...previous, taxTableId: values.taxTableId }));
      } catch (cause) {
        fail(cause);
      }
    }
    const nextItems = toItems(values);
    if (JSON.stringify(nextItems) !== JSON.stringify(saved.items)) {
      try {
        await replaceItems.mutateAsync(nextItems);
        setSaved((previous) => ({ ...previous, items: nextItems }));
      } catch (cause) {
        fail(cause);
      }
    }

    setIsSaving(false);
    if (failure) {
      setFormError(failure);
      return;
    }
    toast.show({ variant: 'success', title: 'Pay saved' });
    onSaved();
  });

  return (
    <form className="pay-form" onSubmit={submit} noValidate>
      <SelectInput label="Tax table" options={options} {...register('taxTableId')} />
      <div className="pay-form__items">
        <PayItemsEditor form={form} name="allowances" noun="allowance" title="Allowances" />
        <PayItemsEditor form={form} name="deductions" noun="deduction" title="Deductions" />
      </div>
      {formError ? (
        <p ref={alertRef} className="pay-form__alert" role="alert" tabIndex={-1}>
          {formError}
        </p>
      ) : null}
      <div className="pay-form__actions">
        <Button type="submit" disabled={!dirty} isLoading={isSaving}>
          Save pay
        </Button>
      </div>
    </form>
  );
}
