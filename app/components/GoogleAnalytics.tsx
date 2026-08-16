'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

const MEASUREMENT_ID = 'G-7CH9W9DQ3J';

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
    roomEqGaConfigured?: boolean;
  }
}

export function GoogleAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag(...args: unknown[]) {
      window.dataLayer.push(args);
    };
    if (!window.roomEqGaConfigured) {
      window.roomEqGaConfigured = true;
      window.gtag('js', new Date());
      window.gtag('config', MEASUREMENT_ID, {
        allow_ad_personalization_signals: false,
        allow_google_signals: false,
        send_page_view: false,
      });
    }
    window.gtag('event', 'page_view', {
      page_location: `${window.location.origin}${pathname}`,
      page_path: pathname,
    });
  }, [pathname]);

  if (process.env.NODE_ENV !== 'production') return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
    </>
  );
}
