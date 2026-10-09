import { useId, type ReactNode } from 'react';
import './card.scss';

interface CardProps {
  title?: string;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

export function Card({ title, actions, footer, children }: CardProps) {
  const headingId = useId();
  return (
    <section className="card" aria-labelledby={title ? headingId : undefined}>
      {title || actions ? (
        <header className="card__header">
          {title ? (
            <h2 id={headingId} className="card__title">
              {title}
            </h2>
          ) : null}
          {actions ? <div className="card__actions">{actions}</div> : null}
        </header>
      ) : null}
      <div className="card__body">{children}</div>
      {footer ? <footer className="card__footer">{footer}</footer> : null}
    </section>
  );
}
