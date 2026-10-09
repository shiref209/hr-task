import { useFieldArray, type UseFormReturn } from 'react-hook-form';
import { Button, TextInput } from '../../../shared/ui';
import type { PayFormValues } from '../form/pay-values';
import { useFormatOnBlur } from '../../../shared/forms/use-format-on-blur';

interface PayItemsEditorProps {
  form: UseFormReturn<PayFormValues>;
  name: 'allowances' | 'deductions';
  /** Singular noun for labels, e.g. "allowance". */
  noun: string;
  title: string;
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export function PayItemsEditor({ form, name, noun, title }: PayItemsEditorProps) {
  const { register, control, formState: { errors } } = form;
  const { fields, append, remove } = useFieldArray({ control, name });
  const formatOnBlur = useFormatOnBlur(form);

  return (
    <fieldset className="pay-items-editor">
      <legend className="pay-items-editor__title">{title}</legend>
      {fields.map((field, index) => {
        const n = index + 1;
        const rowErrors = errors[name]?.[index];
        return (
          <div key={field.id} className="pay-items-editor__row">
            <TextInput
              label={`${capitalize(noun)} name ${n}`}
              error={rowErrors?.name?.message}
              {...register(`${name}.${index}.name`)}
            />
            <TextInput
              label={`${capitalize(noun)} amount ${n}`}
              inputMode="decimal"
              error={rowErrors?.amount?.message}
              {...register(`${name}.${index}.amount`)}
              onBlurCapture={formatOnBlur(`${name}.${index}.amount`)}
            />
            <Button
              variant="ghost"
              className="pay-items-editor__remove"
              aria-label={`Remove ${noun} ${n}`}
              onClick={() => remove(index)}
            >
              <span aria-hidden="true">✕</span>
            </Button>
          </div>
        );
      })}
      <div>
        <Button variant="secondary" onClick={() => append({ name: '', amount: '' })}>
          {`Add ${noun}`}
        </Button>
      </div>
    </fieldset>
  );
}
