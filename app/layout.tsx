import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Classes by Koustav | Student Assessment Portal",
  description:
    "Official student assessment and test dashboard for Classes by Koustav. Track your scheduled tests, access Google Forms assessments, and view your results.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-brand-page text-brand-ink flex flex-col font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
