'use client';

import { createContext, useContext, useState } from 'react';

interface Branding {
  appName: string;
  appLogoUrl: string | null;
}

interface BrandingContextValue extends Branding {
  /** Updates the sidebar name/logo instantly, client-side — no page reload/refetch. */
  setBranding: (branding: Branding) => void;
}

const BrandingContext = createContext<BrandingContextValue>({
  appName: 'Uptime Monitor',
  appLogoUrl: null,
  setBranding: () => {},
});

export function SiteNameProvider({
  appName,
  appLogoUrl,
  children,
}: {
  appName: string;
  appLogoUrl: string | null;
  children: React.ReactNode;
}) {
  const [branding, setBranding] = useState<Branding>({ appName, appLogoUrl });
  return <BrandingContext.Provider value={{ ...branding, setBranding }}>{children}</BrandingContext.Provider>;
}

/** The saved app name (Settings > Application) — used as the breadcrumb's section label everywhere. */
export function useSiteName() {
  return useContext(BrandingContext).appName;
}

/** Sidebar name + logo, plus a setter the Settings page calls on save for instant, reload-free feedback. */
export function useBranding() {
  return useContext(BrandingContext);
}
