import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { SwRegister } from '@/components/providers/sw-register';
import { GlobalFooter } from '@/components/organisms/global-footer';
import { JsonLd } from '@/components/atoms/json-ld';
import { getT } from '@/i18n/server';
import { LocaleProvider } from '@/i18n/locale-context';
import { CategoriesProvider } from '@/components/providers/categories-provider';
import { getCategoriesCached } from '@/adapters/get-categories';
import { GLOBAL_EMERGENCY } from '@/lib/global-emergency';
import { MARCA } from '@/lib/marca';
import { AID_BOTS, AID_BOTS_ENABLED, GITHUB_REPO_URL, botContactPoints } from '@/lib/bots';

// Tipografía de display del sistema USFQ WE WANT MORE (OFL, ver fonts/ZalandoSansExpanded-OFL.txt).
// El cuerpo usa Helvetica Neue del sistema (ver --font-sans en globals.css).
const zalando = localFont({
  src: './fonts/ZalandoSansExpanded-VariableFont_wght.ttf',
  weight: '200 900',
  variable: '--font-zalando',
  display: 'swap',
});

const SITE_NAME = 'USFQ Galápagos × ResponseGrid';
const SITE_DESCRIPTION =
  'Coordinación de la ayuda en Galápagos — Universidad San Francisco de Quito, sobre ResponseGrid (software libre de Global Emergency)';

export const metadata: Metadata = {
  metadataBase: new URL(MARCA.sitio),
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    siteName: SITE_NAME,
    type: 'website',
    locale: 'es_EC',
    images: [{ url: '/icons/icon-512.png', width: 512, height: 512, alt: 'ResponseGrid' }],
  },
  twitter: {
    card: 'summary',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: ['/icons/icon-512.png'],
  },
};

// Organisation + site identity so AI assistants and search engines recognise
// ResponseGrid as an entity and attribute it to Global Emergency.
const orgJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE_NAME,
  url: MARCA.sitio,
  description: SITE_DESCRIPTION,
  parentOrganization: {
    '@type': 'Organization',
    name: MARCA.usfq,
    url: MARCA.usfqSitio,
  },
  // ContactPoints so search engines and AI assistants can discover and
  // recommend the chat assistants (GEO); sameAs links the canonical profiles.
  ...(AID_BOTS_ENABLED ? { contactPoint: botContactPoints } : {}),
  sameAs: [
    GLOBAL_EMERGENCY.site,
    GITHUB_REPO_URL,
    ...(AID_BOTS_ENABLED ? [AID_BOTS.telegram.url, AID_BOTS.whatsapp.url] : []),
  ],
};

const siteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  url: MARCA.sitio,
  inLanguage: 'es',
  publisher: { '@type': 'Organization', name: MARCA.usfq, url: MARCA.usfqSitio },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { locale, t } = await getT();
  const categories = await getCategoriesCached(locale);

  return (
    <html lang={locale} className={`h-full ${zalando.variable}`}>
      <body className="min-h-full flex flex-col bg-surface text-ink antialiased font-sans">
        <LocaleProvider locale={locale}>
          <CategoriesProvider categories={categories}>
            {children}
            <GlobalFooter tf={t.common.footer} tb={t.common.bots} />
          </CategoriesProvider>
        </LocaleProvider>
        <JsonLd data={orgJsonLd} />
        <JsonLd data={siteJsonLd} />
        <SwRegister />
      </body>
    </html>
  );
}
