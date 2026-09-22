import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Uptime Monitor',
  description: 'Self-hosted uptime monitoring dashboard.',
};

/**
 * Applies the saved theme to <html> before paint, so there's no flash of the
 * wrong theme on load. Runs as an inline script (not a React effect) because
 * effects only run after the first paint — too late to prevent the flash.
 * Static, non-interpolated string — safe to inline.
 */
const THEME_INIT_SCRIPT = `
  try {
    var theme = localStorage.getItem('uptime-theme');
    if (theme === 'dark' || theme === 'light') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  } catch (e) {}
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
