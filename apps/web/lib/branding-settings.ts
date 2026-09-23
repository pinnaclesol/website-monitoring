export interface BrandingSettings {
  id: string;
  siteName: string;
  faviconUrl: string | null;
}

const DEFAULT_BRANDING_SETTINGS: BrandingSettings = { id: '', siteName: 'Uptime Monitor', faviconUrl: null };

/**
 * Server-side only — fetches branding directly from apps/api (same pattern
 * as `lib/auth.ts`'s direct call to `/api/auth/validate`), not through the
 * browser-facing proxy. Used by the root layout's `generateMetadata` (runs
 * before any session exists, e.g. on /login) and by the dashboard layout to
 * pass the site name down to the sidebar.
 *
 * Never throws — branding is cosmetic; if apps/api is unreachable the app
 * should still render with sane defaults instead of failing to boot.
 */
export async function getBrandingSettings(): Promise<BrandingSettings> {
  try {
    const res = await fetch(`${process.env.API_URL}/api/settings/branding`, {
      headers: { 'x-internal-api-key': process.env.INTERNAL_API_KEY ?? '' },
      cache: 'no-store',
    });
    if (!res.ok) return DEFAULT_BRANDING_SETTINGS;
    return await res.json();
  } catch {
    return DEFAULT_BRANDING_SETTINGS;
  }
}
