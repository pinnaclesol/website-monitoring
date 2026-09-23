'use client';

import { createContext, useContext } from 'react';

const SiteNameContext = createContext('Uptime Monitor');

export function SiteNameProvider({ siteName, children }: { siteName: string; children: React.ReactNode }) {
  return <SiteNameContext.Provider value={siteName}>{children}</SiteNameContext.Provider>;
}

/** The saved site name (Settings > General) — used as the breadcrumb's section label everywhere. */
export function useSiteName() {
  return useContext(SiteNameContext);
}
