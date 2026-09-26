import type { Metadata, Viewport } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";
import { PwaSetup } from "@/components/pwa/PwaSetup";
import { org, PRODUCT_NAME } from "@/lib/org";

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
  formatDetection: { telephone: false },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: org.colors.navy,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${poppins.variable}`}>
      <body className="min-h-screen bg-brand-page text-brand-ink flex flex-col font-sans antialiased">
        <PwaSetup />
        {children}
      </body>
    </html>
  );
}
