import { BusinessRuleError } from '../../common/errors/domain-errors';
import {
  aDefaultTaxTable,
  aSocialInsurance,
} from '../../../test/fakes/payroll.builder';
import { InMemorySocialInsuranceRepository } from '../../../test/fakes/in-memory-social-insurance-repository';
import { InMemoryTaxTableRepository } from '../../../test/fakes/in-memory-tax-table-repository';
import { SocialInsuranceService } from './social-insurance.service';

function setup(highestBracketRate: string | null = '15.00') {
  const insurance = new InMemorySocialInsuranceRepository(
    aSocialInsurance({ rate: '11.00', cap: '2000.00' }),
  );
  const tables = new InMemoryTaxTableRepository(
    highestBracketRate === null
      ? []
      : [
          aDefaultTaxTable({
            brackets: [
              { upTo: '1000.00', rate: '1.00' },
              { upTo: null, rate: highestBracketRate },
            ],
          }),
        ],
  );
  return { service: new SocialInsuranceService(insurance, tables), insurance };
}

describe('SocialInsuranceService', () => {
  it('returns the current settings', async () => {
    const { service } = setup();

    expect(await service.get()).toEqual({ rate: '11.00', cap: '2000.00' });
  });

  it('saves and returns new settings', async () => {
    const { service, insurance } = setup();

    const saved = await service.update({ rate: '14', cap: '3000.00' });

    expect(saved).toEqual({ rate: '14.00', cap: '3000.00' });
    expect(await insurance.get()).toEqual({ rate: '14.00', cap: '3000.00' });
  });

  it('accepts rate 0 and no cap', async () => {
    const { service } = setup();

    await expect(service.update({ rate: '0', cap: null })).resolves.toEqual({
      rate: '0.00',
      cap: null,
    });
  });

  it('rejects a rate that, with the highest bracket rate of any table, exceeds 100 (edge case 14)', async () => {
    const { service, insurance } = setup('90.00');

    await expect(
      service.update({ rate: '10.01', cap: null }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
    expect(insurance.saved).toBe(0);
  });

  it('accepts a rate that makes the total exactly 100', async () => {
    const { service } = setup('90.00');

    await expect(
      service.update({ rate: '10', cap: null }),
    ).resolves.toMatchObject({ rate: '10.00' });
  });

  it('accepts any rate when no tax table exists yet', async () => {
    const { service } = setup(null);

    await expect(
      service.update({ rate: '100', cap: null }),
    ).resolves.toMatchObject({ rate: '100.00' });
  });
});
