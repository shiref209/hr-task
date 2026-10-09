import type { Payslip } from '@hr/types';
import type { UseQueryResult } from '@tanstack/react-query';
import { toApiError } from '../../../shared/http/http-client';
import { ErrorView, Skeleton, TextInput } from '../../../shared/ui';
import { PayslipView } from './payslip-view';
import '../payroll.scss';

interface PayslipPanelProps {
  month: string;
  onMonthChange: (month: string) => void;
  payslip: UseQueryResult<Payslip>;
}

/** Month picker plus the payslip in all four states; shared by the HR drawer and the employee's own page. */
export function PayslipPanel({ month, onMonthChange, payslip }: PayslipPanelProps) {
  const renderPayslip = () => {
    if (payslip.isError) {
      const { status, message } = toApiError(payslip.error);
      if (status === 422) {
        return (
          <p className="payslip-panel__message" role="status">
            {message}
          </p>
        );
      }
      return <ErrorView error={payslip.error} onRetry={() => void payslip.refetch()} />;
    }
    if (payslip.data === undefined) {
      return (
        <div aria-busy="true">
          <Skeleton variant="rect" />
        </div>
      );
    }
    return (
      <div aria-busy={payslip.isPlaceholderData}>
        <PayslipView payslip={payslip.data} />
      </div>
    );
  };

  return (
    <div className="payslip-panel">
      <TextInput label="Month" type="month" value={month} onChange={(event) => onMonthChange(event.target.value)} />
      {renderPayslip()}
    </div>
  );
}
