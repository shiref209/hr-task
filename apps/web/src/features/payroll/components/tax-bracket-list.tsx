import { formatAmount, type TaxTable } from '@hr/types';
import { formatRate } from '../format-rate';

export function TaxBracketList({ brackets }: { brackets: TaxTable['brackets'] }) {
  return (
    <ul className="tax-bracket-list">
      {brackets.map(({ upTo, rate }) => (
        <li key={upTo ?? 'open'}>
          {upTo === null ? 'above' : `up to ${formatAmount(upTo)}`} · {formatRate(rate)}%
        </li>
      ))}
    </ul>
  );
}
