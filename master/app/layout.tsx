import type { Metadata, Viewport } from "next";
import { Noto_Sans_Bengali, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { site, siteUrl } from "@/lib/site";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

// Only for the logo mark, প্র.
const bengali = Noto_Sans_Bengali({
  subsets: ["bengali"],
  weight: ["700"],
  variable: "--font-bengali",
  display: "swap",
});

const description =
  "Set papers, run proctored exams, mark answer sheets and track every student's progress, in a portal with your own name on it.";

/**
 * This is the site a search for "Proshnopotro" should find: the name leads
 * the title, the home page is the canonical address, and the organisations'
 * portals keep their private pages out of search (portal/app/robots.ts).
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: `${site.name} | ${site.tagline}`, template: `%s | ${site.name}` },
  description,
  applicationName: site.name,
  keywords: [site.name, site.nameBengali, "exam portal", "online test", "tuition", "proctored exam", "answer sheet marking"],
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: site.name, title: `${site.name} | ${site.tagline}`, description, url: "/", locale: "en_IN" },
  twitter: { card: "summary", title: site.name, description },
};

export const viewport: Viewport = {
  themeColor: "#1e1e4b",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${jakarta.variable} ${bengali.variable}`}>
      <head>
        {/* Without JavaScript nothing would fade in, so show it all at once. */}
        <noscript>
          <style>{`.reveal{opacity:1;transform:none}`}</style>
        </noscript>
        {/* Tells search engines the site's name, so "Proshnopotro" shows as it. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: site.name,
              alternateName: site.nameBengali,
              url: siteUrl(),
            }),
          }}
        />
      </head>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
