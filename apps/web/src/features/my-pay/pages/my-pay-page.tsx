import { currentMonth } from '@hr/types';
import { useState } from 'react';
import { usePayslip } from '../../payroll/api/use-payslip';
import { PayslipPanel } from '../../payroll/components/payslip-panel';
import { useSession } from '../../auth/api/use-session';
import { MyTaxTable } from '../components/my-tax-table';
import '../my-pay.scss';

export function MyPayPage() {
  const { data: user } = useSession();
  return (
    <div className="page my-pay-page">
      <h1 className="page__title">My pay</h1>
      {user ? <MyPayslip employeeId={user.employee.id} /> : null}
      <MyTaxTable />
    </div>
  );
}

function MyPayslip({ employeeId }: { employeeId: string }) {
  const [month, setMonth] = useState(currentMonth);
  const payslip = usePayslip(employeeId, month);
  return <PayslipPanel month={month} onMonthChange={setMonth} payslip={payslip} />;
}
