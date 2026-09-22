'use client';

import { useEffect, useState } from 'react';
import { SidebarNavItem } from '@uptime/ui';

const THEME_STORAGE_KEY = 'uptime-theme';

function SunMoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

export function ThemeToggle() {
  // Starts 'light' to match the server-rendered markup (no theme attribute
  // yet); synced to the real value from `document.documentElement` on
  // mount, since the root layout's inline script (not this component) is
  // what actually applies the saved theme before paint.
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
  }, []);

  function toggle() {
    const next = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private browsing / storage disabled — theme just won't persist.
    }
    setIsDark(!isDark);
  }

  return (
    <SidebarNavItem type="button" onClick={toggle}>
      <SunMoonIcon />
      {isDark ? 'Dark mode' : 'Light mode'}
    </SidebarNavItem>
  );
}
