import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Tabs } from './tabs';

const TABS = [
  { id: 'details', label: 'Details' },
  { id: 'pay', label: 'Pay' },
  { id: 'history', label: 'History' },
];

function Harness({ initial = 'details', onChange = () => undefined }: { initial?: string; onChange?: (id: string) => void }) {
  const [active, setActive] = useState(initial);
  return (
    <Tabs
      tabs={TABS}
      activeId={active}
      onChange={(id) => {
        onChange(id);
        setActive(id);
      }}
    >
      <p>Panel for {active}</p>
    </Tabs>
  );
}

const tab = (name: string) => screen.getByRole('tab', { name });

describe('Tabs', () => {
  it('renders a tablist with one tab per entry', () => {
    render(<Harness />);

    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Details', 'Pay', 'History']);
  });

  it('marks only the active tab as selected', () => {
    render(<Harness initial="pay" />);

    expect(tab('Pay')).toHaveAttribute('aria-selected', 'true');
    expect(tab('Details')).toHaveAttribute('aria-selected', 'false');
  });

  it('renders only the active panel, labelled by its tab', () => {
    render(<Harness />);

    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveTextContent('Panel for details');
    expect(panel).toHaveAccessibleName('Details');
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
  });

  it('calls onChange with the tab id on click', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await userEvent.click(tab('Pay'));

    expect(onChange).toHaveBeenCalledWith('pay');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Panel for pay');
  });

  it('keeps only the active tab in the tab order', () => {
    render(<Harness />);

    expect(tab('Details')).toHaveAttribute('tabindex', '0');
    expect(tab('Pay')).toHaveAttribute('tabindex', '-1');
  });

  it('ArrowRight moves selection and focus to the next tab', async () => {
    render(<Harness />);
    tab('Details').focus();

    await userEvent.keyboard('{ArrowRight}');

    expect(tab('Pay')).toHaveAttribute('aria-selected', 'true');
    expect(tab('Pay')).toHaveFocus();
  });

  it('ArrowLeft moves selection and focus to the previous tab', async () => {
    render(<Harness initial="pay" />);
    tab('Pay').focus();

    await userEvent.keyboard('{ArrowLeft}');

    expect(tab('Details')).toHaveAttribute('aria-selected', 'true');
    expect(tab('Details')).toHaveFocus();
  });

  it('ArrowRight on the last tab wraps to the first', async () => {
    render(<Harness initial="history" />);
    tab('History').focus();

    await userEvent.keyboard('{ArrowRight}');

    expect(tab('Details')).toHaveFocus();
    expect(tab('Details')).toHaveAttribute('aria-selected', 'true');
  });

  it('ArrowLeft on the first tab wraps to the last', async () => {
    render(<Harness />);
    tab('Details').focus();

    await userEvent.keyboard('{ArrowLeft}');

    expect(tab('History')).toHaveFocus();
    expect(tab('History')).toHaveAttribute('aria-selected', 'true');
  });
});
