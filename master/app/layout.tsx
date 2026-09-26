import type { Metadata, Viewport } from "next";
import { Noto_Sans_Bengali, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { site } from "@/lib/site";

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

export const metadata: Metadata = {
  title: `${site.name} | ${site.tagline}`,
  description:
    "Set papers, run proctored exams, mark answer sheets and track every student's progress, in a portal with your own name on it.",
  applicationName: site.name,
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
      </head>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
