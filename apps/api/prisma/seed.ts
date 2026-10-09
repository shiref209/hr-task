import { PrismaClient, EmployeeStatus, EmployeeType } from '@prisma/client';

const prisma = new PrismaClient();

const departments = [
  'Engineering',
  'Human Resources',
  'Finance',
  'Sales',
  'Operations',
  'Marketing',
];

interface SeedEmployee {
  fullName: string;
  email: string;
  phone: string | null;
  jobTitle: string;
  department: string;
  hireDate: string;
  baseSalary: string;
  status?: EmployeeStatus;
  type?: EmployeeType;
}

const employees: SeedEmployee[] = [
  {
    fullName: 'Nour El-Sayed',
    email: 'nour.elsayed@example.com',
    phone: '+201001234567',
    jobTitle: 'HR Director',
    department: 'Human Resources',
    hireDate: '2019-03-10',
    baseSalary: '45000.00',
    type: 'HR',
  },
  {
    fullName: 'Hassan Ibrahim',
    email: 'hassan.ibrahim@example.com',
    phone: '+201112345678',
    jobTitle: 'HR Manager',
    department: 'Human Resources',
    hireDate: '2021-06-01',
    baseSalary: '32000.00',
    type: 'HR',
  },
  {
    fullName: 'Omar Farouk',
    email: 'omar.farouk@example.com',
    phone: '+201223456789',
    jobTitle: 'Senior Software Engineer',
    department: 'Engineering',
    hireDate: '2020-01-15',
    baseSalary: '38000.50',
  },
  {
    fullName: 'Laila Mansour',
    email: 'laila.mansour@example.com',
    phone: '+201554567890',
    jobTitle: 'Software Engineer',
    department: 'Engineering',
    hireDate: '2022-09-05',
    baseSalary: '24000.00',
  },
  {
    fullName: 'Karim Adel',
    email: 'karim.adel@example.com',
    phone: null,
    jobTitle: 'QA Engineer',
    department: 'Engineering',
    hireDate: '2023-02-20',
    baseSalary: '18500.75',
  },
  {
    fullName: 'Salma Hegazy',
    email: 'salma.hegazy@example.com',
    phone: '+201009876543',
    jobTitle: 'Accountant',
    department: 'Finance',
    hireDate: '2018-11-12',
    baseSalary: '21000.00',
  },
  {
    fullName: 'Youssef Nabil',
    email: 'youssef.nabil@example.com',
    phone: '+201119876543',
    jobTitle: 'Finance Manager',
    department: 'Finance',
    hireDate: '2017-04-03',
    baseSalary: '41000.00',
  },
  {
    fullName: 'Mariam Khaled',
    email: 'mariam.khaled@example.com',
    phone: '+201229876543',
    jobTitle: 'Sales Representative',
    department: 'Sales',
    hireDate: '2023-07-17',
    baseSalary: '15000.00',
  },
  {
    fullName: 'Tarek Samir',
    email: 'tarek.samir@example.com',
    phone: '+201559876543',
    jobTitle: 'Sales Manager',
    department: 'Sales',
    hireDate: '2019-08-26',
    baseSalary: '35000.00',
  },
  {
    fullName: 'Dina Fathy',
    email: 'dina.fathy@example.com',
    phone: null,
    jobTitle: 'Account Executive',
    department: 'Sales',
    hireDate: '2021-10-11',
    baseSalary: '19500.00',
    status: 'INACTIVE',
  },
  {
    fullName: 'Ahmed Zaki',
    email: 'ahmed.zaki@example.com',
    phone: '+201001112233',
    jobTitle: 'Operations Lead',
    department: 'Operations',
    hireDate: '2018-05-21',
    baseSalary: '29000.00',
  },
  {
    fullName: 'Rana Mostafa',
    email: 'rana.mostafa@example.com',
    phone: '+201111112233',
    jobTitle: 'Logistics Coordinator',
    department: 'Operations',
    hireDate: '2022-03-14',
    baseSalary: '14250.25',
  },
  {
    fullName: 'Mostafa Gamal',
    email: 'mostafa.gamal@example.com',
    phone: '+201221112233',
    jobTitle: 'Warehouse Supervisor',
    department: 'Operations',
    hireDate: '2020-12-07',
    baseSalary: '16800.00',
    status: 'INACTIVE',
  },
  {
    fullName: 'Heba Wahba',
    email: 'heba.wahba@example.com',
    phone: '+201551112233',
    jobTitle: 'Marketing Manager',
    department: 'Marketing',
    hireDate: '2019-02-18',
    baseSalary: '33000.00',
  },
  {
    fullName: 'Sherif Anwar',
    email: 'sherif.anwar@example.com',
    phone: '+201001119988',
    jobTitle: 'Content Specialist',
    department: 'Marketing',
    hireDate: '2024-02-29',
    baseSalary: '12500.00',
  },
];

const payItems: Record<string, { allowances: [string, string][]; deductions: [string, string][] }> = {
  'omar.farouk@example.com': {
    allowances: [['Transport', '1500.00'], ['Housing', '3000.00']],
    deductions: [['Loan repayment', '500.00']],
  },
  'laila.mansour@example.com': { allowances: [['Transport', '1500.00']], deductions: [] },
  'salma.hegazy@example.com': {
    allowances: [['Housing', '2000.00']],
    deductions: [['Loan repayment', '500.00'], ['Loan repayment', '750.00']],
  },
  'tarek.samir@example.com': {
    allowances: [['Transport', '1500.00'], ['Sales commission', '2500.00']],
    deductions: [],
  },
  // Deductions exceed what is left after tax + insurance (spec edge case 13):
  // base 15000: tax 500, insurance 1650 -> 12850 available, 15000 requested, 2150 unapplied.
  'mariam.khaled@example.com': { allowances: [], deductions: [['Salary advance', '15000.00']] },
};

async function seedPayroll(): Promise<void> {
  // Standard table and social insurance come from the payroll_defaults migration.
  // Table names are unique case-insensitively via a raw index, so find-then-create.
  const exemptExists = await prisma.taxTable.findFirst({ where: { name: { equals: 'Exempt', mode: 'insensitive' } } });
  if (!exemptExists)
    await prisma.taxTable.create({
      data: { name: 'Exempt', isDefault: false, brackets: { create: [{ position: 0, upTo: null, rate: '0' }] } },
    });

  for (const [email, { allowances, deductions }] of Object.entries(payItems)) {
    const employee = await prisma.employee.findUniqueOrThrow({ where: { email } });
    const rows = [
      ...allowances.map(([name, amount]) => ({ kind: 'ALLOWANCE' as const, name, amount })),
      ...deductions.map(([name, amount]) => ({ kind: 'DEDUCTION' as const, name, amount })),
    ].map((row, position) => ({ ...row, position, employeeId: employee.id }));
    await prisma.$transaction([
      prisma.employeePayItem.deleteMany({ where: { employeeId: employee.id } }),
      prisma.employeePayItem.createMany({ data: rows }),
    ]);
  }
}

async function main(): Promise<void> {
  const departmentIds = new Map<string, string>();
  for (const name of departments) {
    const department = await prisma.department.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    departmentIds.set(name, department.id);
  }

  for (const { department, hireDate, ...data } of employees) {
    const departmentId = departmentIds.get(department);
    if (!departmentId) throw new Error(`Unknown department: ${department}`);
    const fields = { ...data, departmentId, hireDate: new Date(hireDate) };
    await prisma.employee.upsert({
      where: { email: data.email },
      update: fields,
      create: fields,
    });
  }

  await seedPayroll();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
