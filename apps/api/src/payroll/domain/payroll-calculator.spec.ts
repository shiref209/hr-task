import Decimal from 'decimal.js';
import { calculatePay, PayBreakdown, PayInput } from './payroll-calculator';

const DEFAULT_BRACKETS: PayInput['brackets'] = [
  { upTo: '10000.00', rate: '0' },
  { upTo: '20000.00', rate: '10' },
  { upTo: null, rate: '15' },
];

const aPayInput = (overrides: Partial<PayInput> = {}): PayInput => ({
  baseSalary: '10000.00',
  allowances: [],
  deductions: [],
  brackets: DEFAULT_BRACKETS,
  socialInsurance: { rate: '11', cap: '2000.00' },
  ...overrides,
});

const line = (
  from: string,
  upTo: string | null,
  rate: string,
  taxable: string,
  tax: string,
) => ({
  from,
  upTo,
  rate,
  taxable,
  tax,
});

const sumOf = (values: string[]): string =>
  values.reduce((acc, v) => acc.plus(v), new Decimal(0)).toFixed(2);

describe('calculatePay', () => {
  describe('worked examples (default table, insurance 11% cap 2,000)', () => {
    it('base exactly 10,000.00 is taxed only in the first bracket', () => {
      expect(calculatePay(aPayInput({ baseSalary: '10000.00' }))).toEqual({
        baseSalary: '10000.00',
        allowances: [],
        allowancesTotal: '0.00',
        gross: '10000.00',
        tax: {
          total: '0.00',
          effectiveRate: '0.00',
          brackets: [
            line('0.00', '10000.00', '0.00', '10000.00', '0.00'),
            line('10000.00', '20000.00', '10.00', '0.00', '0.00'),
            line('20000.00', null, '15.00', '0.00', '0.00'),
          ],
        },
        socialInsurance: {
          rate: '11.00',
          cap: '2000.00',
          amount: '1100.00',
          capped: false,
        },
        deductions: [],
        deductionsApplied: '0.00',
        deductionsUnapplied: '0.00',
        net: '8900.00',
      });
    });

    it('base 10,000.01 puts 0.01 in the second bracket and the tax rounds to 0.00', () => {
      expect(calculatePay(aPayInput({ baseSalary: '10000.01' }))).toEqual({
        baseSalary: '10000.01',
        allowances: [],
        allowancesTotal: '0.00',
        gross: '10000.01',
        tax: {
          total: '0.00',
          effectiveRate: '0.00',
          brackets: [
            line('0.00', '10000.00', '0.00', '10000.00', '0.00'),
            line('10000.00', '20000.00', '10.00', '0.01', '0.00'),
            line('20000.00', null, '15.00', '0.00', '0.00'),
          ],
        },
        socialInsurance: {
          rate: '11.00',
          cap: '2000.00',
          amount: '1100.00',
          capped: false,
        },
        deductions: [],
        deductionsApplied: '0.00',
        deductionsUnapplied: '0.00',
        net: '8900.01',
      });
    });

    it('base 20,000.00 hits the insurance cap (2,200 uncapped) and pays 1,000 tax', () => {
      expect(calculatePay(aPayInput({ baseSalary: '20000.00' }))).toEqual({
        baseSalary: '20000.00',
        allowances: [],
        allowancesTotal: '0.00',
        gross: '20000.00',
        tax: {
          total: '1000.00',
          effectiveRate: '5.00',
          brackets: [
            line('0.00', '10000.00', '0.00', '10000.00', '0.00'),
            line('10000.00', '20000.00', '10.00', '10000.00', '1000.00'),
            line('20000.00', null, '15.00', '0.00', '0.00'),
          ],
        },
        socialInsurance: {
          rate: '11.00',
          cap: '2000.00',
          amount: '2000.00',
          capped: true,
        },
        deductions: [],
        deductionsApplied: '0.00',
        deductionsUnapplied: '0.00',
        net: '17000.00',
      });
    });

    it('base 25,000.00 with 1,500 allowance and 500 deduction nets 22,250.00', () => {
      expect(
        calculatePay(
          aPayInput({
            baseSalary: '25000.00',
            allowances: [{ name: 'Housing', amount: '1500.00' }],
            deductions: [{ name: 'Loan', amount: '500.00' }],
          }),
        ),
      ).toEqual({
        baseSalary: '25000.00',
        allowances: [{ name: 'Housing', amount: '1500.00' }],
        allowancesTotal: '1500.00',
        gross: '26500.00',
        tax: {
          total: '1750.00',
          effectiveRate: '7.00',
          brackets: [
            line('0.00', '10000.00', '0.00', '10000.00', '0.00'),
            line('10000.00', '20000.00', '10.00', '10000.00', '1000.00'),
            line('20000.00', null, '15.00', '5000.00', '750.00'),
          ],
        },
        socialInsurance: {
          rate: '11.00',
          cap: '2000.00',
          amount: '2000.00',
          capped: true,
        },
        deductions: [{ name: 'Loan', requested: '500.00', applied: '500.00' }],
        deductionsApplied: '500.00',
        deductionsUnapplied: '0.00',
        net: '22250.00',
      });
    });

    it('base 12,345.65 rounds tax 234.565 up and insurance 1,358.0215 down', () => {
      expect(calculatePay(aPayInput({ baseSalary: '12345.65' }))).toEqual({
        baseSalary: '12345.65',
        allowances: [],
        allowancesTotal: '0.00',
        gross: '12345.65',
        tax: {
          total: '234.57',
          effectiveRate: '1.90',
          brackets: [
            line('0.00', '10000.00', '0.00', '10000.00', '0.00'),
            line('10000.00', '20000.00', '10.00', '2345.65', '234.57'),
            line('20000.00', null, '15.00', '0.00', '0.00'),
          ],
        },
        socialInsurance: {
          rate: '11.00',
          cap: '2000.00',
          amount: '1358.02',
          capped: false,
        },
        deductions: [],
        deductionsApplied: '0.00',
        deductionsUnapplied: '0.00',
        net: '10753.06',
      });
    });

    it('base 5,000.00 with 6,000 requested applies 4,450 and leaves 1,550 unapplied', () => {
      expect(
        calculatePay(
          aPayInput({
            baseSalary: '5000.00',
            deductions: [{ name: 'Advance', amount: '6000.00' }],
          }),
        ),
      ).toEqual({
        baseSalary: '5000.00',
        allowances: [],
        allowancesTotal: '0.00',
        gross: '5000.00',
        tax: {
          total: '0.00',
          effectiveRate: '0.00',
          brackets: [
            line('0.00', '10000.00', '0.00', '5000.00', '0.00'),
            line('10000.00', '20000.00', '10.00', '0.00', '0.00'),
            line('20000.00', null, '15.00', '0.00', '0.00'),
          ],
        },
        socialInsurance: {
          rate: '11.00',
          cap: '2000.00',
          amount: '550.00',
          capped: false,
        },
        deductions: [
          { name: 'Advance', requested: '6000.00', applied: '4450.00' },
        ],
        deductionsApplied: '4450.00',
        deductionsUnapplied: '1550.00',
        net: '0.00',
      });
    });
  });

  describe('bracket boundaries', () => {
    it('base 20,000.01 puts 0.01 in the open bracket; its 0.0015 tax rounds to 0.00', () => {
      const slip = calculatePay(aPayInput({ baseSalary: '20000.01' }));

      expect(slip.tax.brackets).toEqual([
        line('0.00', '10000.00', '0.00', '10000.00', '0.00'),
        line('10000.00', '20000.00', '10.00', '10000.00', '1000.00'),
        line('20000.00', null, '15.00', '0.01', '0.00'),
      ]);
      expect(slip.tax.total).toBe('1000.00');
      expect(slip.tax.effectiveRate).toBe('5.00');
      expect(slip.socialInsurance).toMatchObject({
        amount: '2000.00',
        capped: true,
      });
      expect(slip.net).toBe('17000.01');
    });

    it('base below the first limit leaves later brackets untouched', () => {
      const slip = calculatePay(aPayInput({ baseSalary: '1234.56' }));

      expect(slip.tax.brackets).toEqual([
        line('0.00', '10000.00', '0.00', '1234.56', '0.00'),
        line('10000.00', '20000.00', '10.00', '0.00', '0.00'),
        line('20000.00', null, '15.00', '0.00', '0.00'),
      ]);
      expect(slip.socialInsurance.amount).toBe('135.80');
      expect(slip.net).toBe('1098.76');
    });

    it('keeps a very large base exact', () => {
      const slip = calculatePay(aPayInput({ baseSalary: '9999999999.99' }));

      expect(slip.tax.brackets[2]).toEqual(
        line('20000.00', null, '15.00', '9999979999.99', '1499997000.00'),
      );
      expect(slip.tax.total).toBe('1499998000.00');
      expect(slip.tax.effectiveRate).toBe('15.00');
      expect(slip.socialInsurance).toMatchObject({
        amount: '2000.00',
        capped: true,
      });
      expect(slip.net).toBe('8499999999.99');
    });
  });

  describe('flat single-bracket table', () => {
    it('0% table taxes nobody', () => {
      const slip = calculatePay(
        aPayInput({
          baseSalary: '3000.00',
          brackets: [{ upTo: null, rate: '0' }],
        }),
      );

      expect(slip.tax).toEqual({
        total: '0.00',
        effectiveRate: '0.00',
        brackets: [line('0.00', null, '0.00', '3000.00', '0.00')],
      });
      expect(slip.net).toBe('2670.00');
    });

    it('20% table taxes the whole base', () => {
      const slip = calculatePay(
        aPayInput({
          baseSalary: '3000.00',
          brackets: [{ upTo: null, rate: '20' }],
        }),
      );

      expect(slip.tax).toEqual({
        total: '600.00',
        effectiveRate: '20.00',
        brackets: [line('0.00', null, '20.00', '3000.00', '600.00')],
      });
      expect(slip.net).toBe('2070.00');
    });
  });

  describe('social insurance', () => {
    it('rate 0 gives zero insurance', () => {
      const slip = calculatePay(
        aPayInput({
          baseSalary: '5000.00',
          socialInsurance: { rate: '0', cap: '2000.00' },
        }),
      );

      expect(slip.socialInsurance).toEqual({
        rate: '0.00',
        cap: '2000.00',
        amount: '0.00',
        capped: false,
      });
      expect(slip.net).toBe('5000.00');
    });

    it('without a cap the full percentage applies and capped is false', () => {
      const slip = calculatePay(
        aPayInput({
          baseSalary: '50000.00',
          socialInsurance: { rate: '11', cap: null },
        }),
      );

      expect(slip.socialInsurance).toEqual({
        rate: '11.00',
        cap: null,
        amount: '5500.00',
        capped: false,
      });
      expect(slip.tax.total).toBe('5500.00');
      expect(slip.net).toBe('39000.00');
    });

    it('insurance exactly at the cap is not flagged as capped', () => {
      const slip = calculatePay(
        aPayInput({
          baseSalary: '20000.00',
          socialInsurance: { rate: '10', cap: '2000.00' },
        }),
      );

      expect(slip.socialInsurance).toEqual({
        rate: '10.00',
        cap: '2000.00',
        amount: '2000.00',
        capped: false,
      });
    });

    it('insurance above the cap is limited to the cap and flagged as capped', () => {
      const slip = calculatePay(aPayInput({ baseSalary: '20000.00' }));

      expect(slip.socialInsurance).toMatchObject({
        amount: '2000.00',
        capped: true,
      });
    });
  });

  describe('allowances', () => {
    it('without allowances gross equals base and the total is 0.00', () => {
      const slip = calculatePay(aPayInput({ baseSalary: '8000.00' }));

      expect(slip.allowances).toEqual([]);
      expect(slip.allowancesTotal).toBe('0.00');
      expect(slip.gross).toBe('8000.00');
    });

    it('sums several allowances into gross without taxing them', () => {
      const slip = calculatePay(
        aPayInput({
          baseSalary: '20000.00',
          allowances: [
            { name: 'Housing', amount: '1000.25' },
            { name: 'Transport', amount: '2000.50' },
          ],
        }),
      );

      expect(slip.allowances).toEqual([
        { name: 'Housing', amount: '1000.25' },
        { name: 'Transport', amount: '2000.50' },
      ]);
      expect(slip.allowancesTotal).toBe('3000.75');
      expect(slip.gross).toBe('23000.75');
      expect(slip.tax.total).toBe('1000.00');
      expect(slip.net).toBe('20000.75');
    });
  });

  describe('deductions', () => {
    it('without deductions nothing is applied', () => {
      const slip = calculatePay(aPayInput());

      expect(slip.deductions).toEqual([]);
      expect(slip.deductionsApplied).toBe('0.00');
      expect(slip.deductionsUnapplied).toBe('0.00');
    });

    it('applies every deduction in full when enough is available', () => {
      const slip = calculatePay(
        aPayInput({
          deductions: [
            { name: 'Rent', amount: '1000.00' },
            { name: 'Loan', amount: '250.50' },
          ],
        }),
      );

      expect(slip.deductions).toEqual([
        { name: 'Rent', requested: '1000.00', applied: '1000.00' },
        { name: 'Loan', requested: '250.50', applied: '250.50' },
      ]);
      expect(slip.deductionsApplied).toBe('1250.50');
      expect(slip.deductionsUnapplied).toBe('0.00');
      expect(slip.net).toBe('7649.50');
    });

    it('applies in list order, partially for the crossing item, and zero for later ones', () => {
      const slip = calculatePay(
        aPayInput({
          baseSalary: '5000.00',
          deductions: [
            { name: 'A', amount: '3000.00' },
            { name: 'B', amount: '2000.00' },
            { name: 'C', amount: '500.00' },
          ],
        }),
      );

      expect(slip.deductions).toEqual([
        { name: 'A', requested: '3000.00', applied: '3000.00' },
        { name: 'B', requested: '2000.00', applied: '1450.00' },
        { name: 'C', requested: '500.00', applied: '0.00' },
      ]);
      expect(slip.deductionsApplied).toBe('4450.00');
      expect(slip.deductionsUnapplied).toBe('1050.00');
      expect(slip.net).toBe('0.00');
    });

    it('a deduction equal to what is available leaves nothing unapplied and net 0.00', () => {
      const slip = calculatePay(
        aPayInput({
          baseSalary: '5000.00',
          deductions: [{ name: 'All', amount: '4450.00' }],
        }),
      );

      expect(slip.deductionsApplied).toBe('4450.00');
      expect(slip.deductionsUnapplied).toBe('0.00');
      expect(slip.net).toBe('0.00');
    });
  });

  describe('rounding half-up per line', () => {
    const flat = (rate: string) => [{ upTo: null, rate }];
    const noInsurance = { rate: '0', cap: null };

    it('rounds a bracket line ending in exactly 5 at the third decimal up', () => {
      const slip = calculatePay(
        aPayInput({
          baseSalary: '0.01',
          brackets: flat('50'),
          socialInsurance: noInsurance,
        }),
      );

      expect(slip.tax.total).toBe('0.01');
      expect(slip.net).toBe('0.00');
    });

    it('rounds a bracket line of .xx4999 down', () => {
      const slip = calculatePay(
        aPayInput({
          baseSalary: '0.01',
          brackets: flat('49.99'),
          socialInsurance: noInsurance,
        }),
      );

      expect(slip.tax.total).toBe('0.00');
      expect(slip.net).toBe('0.01');
    });

    it('rounds insurance at x.xx5 up', () => {
      const slip = calculatePay(
        aPayInput({
          baseSalary: '0.01',
          brackets: flat('0'),
          socialInsurance: { rate: '50', cap: null },
        }),
      );

      expect(slip.socialInsurance.amount).toBe('0.01');
    });

    it('rounds insurance of 1,358.0215 down to 1,358.02', () => {
      const slip = calculatePay(aPayInput({ baseSalary: '12345.65' }));

      expect(slip.socialInsurance.amount).toBe('1358.02');
    });

    it('tax total is the sum of the rounded bracket lines, not the rounded exact sum', () => {
      const slip = calculatePay(
        aPayInput({
          baseSalary: '0.09',
          brackets: [
            { upTo: '0.03', rate: '50' },
            { upTo: '0.06', rate: '50' },
            { upTo: null, rate: '50' },
          ],
          socialInsurance: noInsurance,
        }),
      );

      expect(slip.tax.brackets.map((b) => b.tax)).toEqual([
        '0.02',
        '0.02',
        '0.02',
      ]);
      expect(slip.tax.total).toBe('0.06');
      expect(slip.tax.effectiveRate).toBe('66.67');
      expect(slip.net).toBe('0.03');
    });

    const invariantCases: [string, PayInput][] = [
      ['default table, plain base', aPayInput()],
      ['base on the second limit', aPayInput({ baseSalary: '20000.00' })],
      ['half-up tax line', aPayInput({ baseSalary: '12345.65' })],
      [
        'allowances and deductions',
        aPayInput({
          baseSalary: '25000.00',
          allowances: [{ name: 'A', amount: '1500.33' }],
          deductions: [{ name: 'D', amount: '500.77' }],
        }),
      ],
      [
        'deductions exceed available',
        aPayInput({
          baseSalary: '5000.00',
          deductions: [{ name: 'D', amount: '6000.00' }],
        }),
      ],
      ['tiny base', aPayInput({ baseSalary: '0.01' })],
      ['large base', aPayInput({ baseSalary: '9999999999.99' })],
      [
        'flat 12.5% with no cap',
        aPayInput({
          baseSalary: '1000.04',
          brackets: [{ upTo: null, rate: '12.5' }],
          socialInsurance: { rate: '7.25', cap: null },
        }),
      ],
      [
        'odd rates with several deductions',
        aPayInput({
          baseSalary: '33333.33',
          brackets: [
            { upTo: '12345.67', rate: '3.33' },
            { upTo: '23456.78', rate: '17.77' },
            { upTo: null, rate: '31.31' },
          ],
          socialInsurance: { rate: '9.99', cap: '3000.00' },
          deductions: [
            { name: 'X', amount: '100.10' },
            { name: 'Y', amount: '99999.99' },
            { name: 'Z', amount: '1.00' },
          ],
        }),
      ],
      [
        'zero-rate insurance and allowances only',
        aPayInput({
          baseSalary: '7777.77',
          allowances: [
            { name: 'A', amount: '0.01' },
            { name: 'B', amount: '999.99' },
          ],
          socialInsurance: { rate: '0', cap: null },
        }),
      ],
    ];

    it.each(invariantCases)(
      'gross - tax - insurance - applied = net exactly (%s)',
      (_name, input) => {
        const slip: PayBreakdown = calculatePay(input);

        const expectedNet = new Decimal(slip.gross)
          .minus(slip.tax.total)
          .minus(slip.socialInsurance.amount)
          .minus(slip.deductionsApplied)
          .toFixed(2);
        expect(slip.net).toBe(expectedNet);
        expect(slip.tax.total).toBe(sumOf(slip.tax.brackets.map((b) => b.tax)));
        expect(slip.deductionsApplied).toBe(
          sumOf(slip.deductions.map((d) => d.applied)),
        );
        expect(new Decimal(slip.net).gte(0)).toBe(true);
      },
    );
  });

  describe('output formatting', () => {
    it('formats every money and rate field with exactly 2 decimals', () => {
      const slip = calculatePay(
        aPayInput({
          baseSalary: '1100',
          allowances: [{ name: 'A', amount: '5' }],
          deductions: [{ name: 'D', amount: '10' }],
          brackets: [
            { upTo: '500', rate: '0' },
            { upTo: null, rate: '10' },
          ],
          socialInsurance: { rate: '11', cap: '2000' },
        }),
      );

      const twoDecimals = /^\d+\.\d{2}$/;
      const moneyFields = [
        slip.baseSalary,
        slip.allowances[0].amount,
        slip.allowancesTotal,
        slip.gross,
        slip.tax.total,
        slip.tax.effectiveRate,
        ...slip.tax.brackets.flatMap((b) => [b.from, b.rate, b.taxable, b.tax]),
        slip.tax.brackets[0].upTo,
        slip.socialInsurance.rate,
        slip.socialInsurance.cap,
        slip.socialInsurance.amount,
        slip.deductions[0].requested,
        slip.deductions[0].applied,
        slip.deductionsApplied,
        slip.deductionsUnapplied,
        slip.net,
      ];
      moneyFields.forEach((value) => expect(value).toMatch(twoDecimals));
      expect(slip.baseSalary).toBe('1100.00');
      expect(slip.tax.brackets[1].upTo).toBeNull();
      expect(slip.deductionsUnapplied).toBe('0.00');
    });
  });
});
