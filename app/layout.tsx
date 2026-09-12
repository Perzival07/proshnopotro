import type { Metadata, Viewport } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";
import { PwaSetup } from "@/components/pwa/PwaSetup";

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
  title: "Classes by Koustav | Student Assessment Portal",
  description:
    "Official student assessment and test dashboard for Classes by Koustav. Track your scheduled tests, access Google Forms assessments, and view your results.",
  applicationName: "Classes by Koustav",
  // iPhone and iPad read these rather than the manifest when the portal is
  // added to the home screen: open full screen, under this name.
  appleWebApp: {
    capable: true,
    title: "Koustav",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0A4B8C",
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
