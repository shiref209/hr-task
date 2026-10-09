import { ProblemType, type SocialInsurance } from '@hr/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../shared/http/http-client';
import { ToastProvider } from '../../../shared/ui';
import { fetchSocialInsurance, updateSocialInsurance } from '../api/payroll-api';
import { aSocialInsurance } from '../test-utils';
import { SocialInsurancePage } from './social-insurance-page';

vi.mock('../api/payroll-api', () => ({
  fetchSocialInsurance: vi.fn(),
  updateSocialInsurance: vi.fn(),
}));

const fetchMock = vi.mocked(fetchSocialInsurance);
const updateMock = vi.mocked(updateSocialInsurance);

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <SocialInsurancePage />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const apiError = (status: number, extra: Record<string, unknown> = {}) =>
  new ApiError({ type: ProblemType.validationError, title: 'Problem', status, ...extra });

/** Matches a label ignoring the trailing required-asterisk. */
const rateField = () => screen.getByLabelText(/^Rate %(\s\*)?$/);
const capField = () => screen.getByLabelText(/^Cap(\s\*)?$/);
const queryCapField = () => screen.queryByLabelText(/^Cap(\s\*)?$/);
const capToggle = () => screen.getByRole('checkbox', { name: 'Cap the monthly contribution' });
const save = () => screen.getByRole('button', { name: 'Save' });

async function renderLoaded(values: SocialInsurance = aSocialInsurance()) {
  fetchMock.mockResolvedValue(values);
  renderPage();
  await screen.findByLabelText(/^Rate %/);
}

beforeEach(() => {
  vi.resetAllMocks();
  updateMock.mockResolvedValue(aSocialInsurance());
});

describe('Social insurance page - loading (edge case 12)', () => {
  it('has a "Social insurance" heading', async () => {
    await renderLoaded();

    expect(screen.getByRole('heading', { name: 'Social insurance', level: 1 })).toBeInTheDocument();
  });

  it('loads the rate and a checked, formatted cap', async () => {
    await renderLoaded(aSocialInsurance({ rate: '11.00', cap: '2000.00' }));

    expect(rateField()).toHaveValue('11.00');
    expect(capToggle()).toBeChecked();
    expect(capField()).toHaveValue('2,000.00');
  });

  it('loads a null cap as unchecked with no Cap field', async () => {
    await renderLoaded(aSocialInsurance({ cap: null }));

    expect(capToggle()).not.toBeChecked();
    expect(queryCapField()).not.toBeInTheDocument();
  });

  it('shows an alert when loading fails', async () => {
    fetchMock.mockRejectedValue(
      new ApiError({ type: 'about:blank', title: 'Request failed', status: 500, detail: 'Database unavailable' }),
    );
    renderPage();

    const text = await screen.findByText('Database unavailable');
    expect(text.closest('[role="alert"]')).not.toBeNull();
  });
});

describe('Social insurance page - cap checkbox (edge case 12)', () => {
  it('hides the Cap field when unchecked and sends cap null', async () => {
    await renderLoaded();

    await userEvent.click(capToggle());
    expect(queryCapField()).not.toBeInTheDocument();
    await userEvent.click(save());

    await waitFor(() => expect(updateMock).toHaveBeenCalledOnce());
    expect(updateMock.mock.calls[0]?.[0]).toEqual({ rate: '11.00', cap: null });
  });

  it('shows an empty Cap field when checked and requires a cap above 0', async () => {
    await renderLoaded(aSocialInsurance({ cap: null }));

    await userEvent.click(capToggle());
    expect(capField()).toHaveValue('');
    await userEvent.click(save());

    expect(await screen.findByText(/greater than 0/i)).toBeInTheDocument();
    expect(capField()).toBeInvalid();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('rejects a cap of 0', async () => {
    await renderLoaded(aSocialInsurance({ cap: null }));
    await userEvent.click(capToggle());
    await userEvent.type(capField(), '0');

    await userEvent.click(save());

    expect(await screen.findByText(/greater than 0/i)).toBeInTheDocument();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('formats the cap on blur and sends it normalised', async () => {
    await renderLoaded(aSocialInsurance({ cap: null }));
    await userEvent.click(capToggle());
    await userEvent.type(capField(), '2500');
    await userEvent.tab();
    expect(capField()).toHaveValue('2,500.00');

    await userEvent.click(save());

    await waitFor(() => expect(updateMock).toHaveBeenCalledOnce());
    expect(updateMock.mock.calls[0]?.[0]).toEqual({ rate: '11.00', cap: '2500.00' });
  });

  it('has no live example line', async () => {
    await renderLoaded();

    expect(screen.queryByText(/example/i)).not.toBeInTheDocument();
  });
});

describe('Social insurance page - rate validation', () => {
  it('shows the schema message for a rate above 100 and does not save', async () => {
    await renderLoaded();
    await userEvent.clear(rateField());
    await userEvent.type(rateField(), '101');

    await userEvent.click(save());

    expect(await screen.findByText(/rate between 0 and 100/i)).toBeInTheDocument();
    expect(rateField()).toBeInvalid();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('formats the rate to 2 decimals on blur', async () => {
    await renderLoaded();
    await userEvent.clear(rateField());
    await userEvent.type(rateField(), '12.5');
    await userEvent.tab();

    expect(rateField()).toHaveValue('12.50');
  });
});

describe('Social insurance page - saving (edge case 13)', () => {
  it('disables Save while nothing has changed and enables it after an edit', async () => {
    await renderLoaded();
    expect(save()).toBeDisabled();

    await userEvent.type(rateField(), '5');

    expect(save()).toBeEnabled();
  });

  it('toasts on success and disables Save again', async () => {
    await renderLoaded();
    await userEvent.clear(rateField());
    await userEvent.type(rateField(), '12');
    fetchMock.mockResolvedValue(aSocialInsurance({ rate: '12.00' }));

    await userEvent.click(save());

    expect(await screen.findByText('Social insurance saved')).toBeInTheDocument();
    expect(updateMock.mock.calls[0]?.[0]).toEqual({ rate: '12.00', cap: '2000.00' });
    await waitFor(() => expect(save()).toBeDisabled());
  });

  it('shows a 422 rate ceiling as a form alert with the server detail and keeps the input', async () => {
    const detail = 'Highest tax bracket rate + insurance rate must not exceed 100%';
    updateMock.mockRejectedValue(apiError(422, { type: ProblemType.businessRuleViolation, detail }));
    await renderLoaded();
    await userEvent.clear(rateField());
    await userEvent.type(rateField(), '90');

    await userEvent.click(save());

    const form = rateField().closest('form');
    if (!form) throw new Error('Rate field is not inside a form');
    expect(await within(form).findByRole('alert')).toHaveTextContent(detail);
    expect(rateField()).toHaveValue('90.00');
    expect(save()).toBeEnabled();
  });
});
