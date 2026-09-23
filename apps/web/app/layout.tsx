import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { Providers } from './providers';
import { getBrandingSettings } from '../lib/branding-settings';

/**
 * Dynamic (not a static `export const metadata`) so the page title and
 * favicon reflect the admin's saved branding (Settings > General) — this
 * runs on every request, before any session exists, so it applies on
 * /login too, not just inside the dashboard.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { siteTitle, faviconUrl } = await getBrandingSettings();
  return {
    title: siteTitle,
    description: 'Self-hosted uptime monitoring dashboard.',
    icons: faviconUrl ? { icon: faviconUrl } : undefined,
  };
}

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
