import type { Metadata, Viewport } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";
import { PwaSetup } from "@/components/pwa/PwaSetup";
import { org, PRODUCT_NAME } from "@/lib/org";
import { isSuspended } from "@/lib/master";
import { SuspendedNotice } from "@/components/SuspendedNotice";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: `${org.name} | Student Assessment Portal`,
  description:
    `Official student assessment and test dashboard for ${org.name}. Track your scheduled tests, access Google Forms assessments, and view your results.`,
  applicationName: org.name,
  generator: PRODUCT_NAME,
  // iPhone and iPad read these rather than the manifest when the portal is
  // added to the home screen: open full screen, under this name.
  appleWebApp: {
    capable: true,
    title: org.shortName,
    statusBarStyle: "default",
  },
  // The organisation's own, copied in from orgs/<ORG>/public at build time.
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: { url: "/icons/apple-icon.png", sizes: "180x180" },
  },
  formatDetection: { telephone: false },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: org.colors.navy,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${poppins.variable}`}>
      <body className="min-h-screen bg-brand-page text-brand-ink flex flex-col font-sans antialiased">
        <PwaSetup />
        {/* Suspended by the platform owner (the master app): no page opens. */}
        {(await isSuspended()) ? <SuspendedNotice /> : children}
      </body>
    </html>
  );
}
