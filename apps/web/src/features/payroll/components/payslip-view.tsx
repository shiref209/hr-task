import type { Payslip } from '@hr/types';
import { formatAmount } from '../../../shared/format/format-amount';
import { formatRate } from '../format-rate';

const isZero = (amount: string) => !/[1-9]/.test(amount);
const deduct = (amount: string) => (isZero(amount) ? formatAmount(amount) : `-${formatAmount(amount)}`);

function Line({ label, amount, tone }: { label: string; amount: string; tone?: 'strong' | 'sub' }) {
  return (
    <div className={tone ? `payslip-view__line payslip-view__line--${tone}` : 'payslip-view__line'}>
      <span>{label}</span>
      <span className="payslip-view__amount">{amount}</span>
    </div>
  );
}

export function PayslipView({ payslip }: { payslip: Payslip }) {
  const { tax, socialInsurance } = payslip;
  const insuranceNote = socialInsurance.capped ? ', capped' : '';
  return (
    <div className="payslip-view">
      <Line label="Base salary" amount={formatAmount(payslip.baseSalary)} />
      {payslip.allowances.map(({ name, amount }, index) => (
        <Line key={`${name}-${index}`} label={name} amount={formatAmount(amount)} />
      ))}
      <Line label="Gross" amount={formatAmount(payslip.gross)} tone="strong" />
      <Line
        label={`Tax (${payslip.taxTable.name}, ${formatRate(tax.effectiveRate)}%)`}
        amount={deduct(tax.total)}
      />
      {tax.brackets.map((bracket) => (
        <Line
          key={bracket.from}
          tone="sub"
          label={`${
            bracket.upTo === null
              ? `above ${formatAmount(bracket.from)}`
              : `${formatAmount(bracket.from)} – ${formatAmount(bracket.upTo)}`
          } @ ${formatRate(bracket.rate)}%`}
          amount={formatAmount(bracket.tax)}
        />
      ))}
      <Line
        label={`Social insurance (${formatRate(socialInsurance.rate)}%${insuranceNote})`}
        amount={deduct(socialInsurance.amount)}
      />
      {payslip.deductions.map(({ name, requested, applied }, index) => (
        <Line
          key={`${name}-${index}`}
          label={name}
          amount={
            requested === applied
              ? deduct(applied)
              : `${formatAmount(requested)} → ${formatAmount(applied)}`
          }
        />
      ))}
      <Line label="Net" amount={formatAmount(payslip.net)} tone="strong" />
      {payslip.warnings.length > 0 ? (
        <div role="alert" className="payslip-view__warnings">
          {payslip.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
