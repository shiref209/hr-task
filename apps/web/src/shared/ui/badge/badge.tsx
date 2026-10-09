import type { ReactNode } from 'react';
import './badge.scss';

interface BadgeProps {
  tone?: 'neutral' | 'success' | 'danger' | 'warning' | 'info';
  children: ReactNode;
}

export function Badge({ tone = 'neutral', children }: BadgeProps) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}
