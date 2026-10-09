export const payrollKeys = {
  taxTables: ['tax-tables'] as const,
  socialInsurance: ['social-insurance'] as const,
  payItems: (employeeId: string) => ['pay-items', employeeId] as const,
  payslips: (employeeId: string) => ['payslip', employeeId] as const,
  payslip: (employeeId: string, month: string) => ['payslip', employeeId, month] as const,
};
