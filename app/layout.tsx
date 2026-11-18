import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "My English Tutor",
  description: "Your private AI English teacher for daily speaking practice.",
  manifest: "/manifest.webmanifest",
  applicationName: "English Tutor",
  appleWebApp: { capable: true, title: "English Tutor", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f7fb",
};

// Applies the saved theme before first paint to avoid a flash.
const themeScript = `try{var t=JSON.parse(localStorage.getItem('ui.theme')||'"system"');var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');var l=JSON.parse(localStorage.getItem('ui.lang')||'"en"');document.documentElement.lang=l;document.documentElement.dir=l==='ar'?'rtl':'ltr';}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh font-sans antialiased">
        <Script id="theme-init" strategy="beforeInteractive">{themeScript}</Script>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
