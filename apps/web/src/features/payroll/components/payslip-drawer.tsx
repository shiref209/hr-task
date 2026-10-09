import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { currentMonth } from '@hr/types';
import { toApiError } from '../../../shared/http/http-client';
import { Drawer, ErrorView, Skeleton, TextInput, useToast } from '../../../shared/ui';
import { employeeKeys } from '../../employees/api/employee-keys';
import { usePayslip } from '../api/use-payslip';
import { PayslipView } from './payslip-view';
import '../payroll.scss';

export interface PayslipTarget {
  id: string;
  name: string;
}

interface PayslipDrawerProps {
  target: PayslipTarget | null;
  onClose: () => void;
}

export function PayslipDrawer({ target, onClose }: PayslipDrawerProps) {
  return (
    <Drawer open={target !== null} title={target ? `Payslip — ${target.name}` : 'Payslip'} onRequestClose={onClose}>
      {target ? <PayslipBody employeeId={target.id} onClose={onClose} /> : null}
    </Drawer>
  );
}

// Mounted per open, so the month starts on the current one every time.
function PayslipBody({ employeeId, onClose }: { employeeId: string; onClose: () => void }) {
  const [month, setMonth] = useState(currentMonth);
  const payslip = usePayslip(employeeId, month);
  const toast = useToast();
  const queryClient = useQueryClient();

  const status = payslip.isError ? toApiError(payslip.error).status : undefined;
  useEffect(() => {
    if (status !== 404) return;
    toast.show({ variant: 'error', title: 'This employee no longer exists' });
    void queryClient.invalidateQueries({ queryKey: employeeKeys.lists });
    onClose();
  }, [status, toast, queryClient, onClose]);

  const renderPayslip = () => {
    if (payslip.isError) {
      if (status === 422) {
        return (
          <p className="payslip-drawer__message" role="status">
            {toApiError(payslip.error).message}
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
    <div className="payslip-drawer">
      <TextInput label="Month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
      {renderPayslip()}
    </div>
  );
}
