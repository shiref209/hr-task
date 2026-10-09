import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useSession } from '../features/auth/api/use-session';
import { UserMenu } from '../features/auth/components/user-menu';
import './app-layout.scss';

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const user = useSession().data ?? null;
  const isHr = user?.role === 'HR';
  const menuButton = useRef<HTMLButtonElement>(null);

  const closeMenu = () => {
    setMenuOpen(false);
    menuButton.current?.focus();
  };

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMenuOpen(false);
      menuButton.current?.focus();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);

  return (
    <div className="app-layout">
      <header className="app-layout__bar">
        <button
          ref={menuButton}
          type="button"
          className="app-layout__menu-button"
          aria-label="Open menu"
          aria-expanded={menuOpen}
          aria-controls="app-sidebar"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span aria-hidden="true">☰</span>
        </button>
        <span className="app-layout__brand">HR Payroll</span>
      </header>
      <div
        id="app-sidebar"
        className={menuOpen ? 'app-layout__sidebar app-layout__sidebar--open' : 'app-layout__sidebar'}
      >
        <span className="app-layout__brand app-layout__brand--sidebar">HR Payroll</span>
        <nav aria-label="Main">
          <ul className="app-layout__list">
            <li>
              <NavLink to="/employees" className="app-layout__link" onClick={closeMenu}>
                Employees
              </NavLink>
            </li>
            {isHr ? (
              <li className="app-layout__group">
                <p className="app-layout__group-title">Settings</p>
                <ul className="app-layout__list">
                  <li>
                    <NavLink to="/settings/tax-tables" className="app-layout__link" onClick={closeMenu}>
                      Tax tables
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/settings/social-insurance" className="app-layout__link" onClick={closeMenu}>
                      Social insurance
                    </NavLink>
                  </li>
                </ul>
              </li>
            ) : (
              <li>
                <NavLink to="/my-pay" className="app-layout__link" onClick={closeMenu}>
                  My pay
                </NavLink>
              </li>
            )}
          </ul>
        </nav>
        {user ? <UserMenu user={user} /> : null}
      </div>
      <main className="app-layout__main">
        <Outlet />
      </main>
    </div>
  );
}
