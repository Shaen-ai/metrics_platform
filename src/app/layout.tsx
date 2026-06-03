import type { Metadata } from "next";
import "./globals.css";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { ThemeProvider } from "@/components/ThemeProvider";

const GOOGLE_FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,300..600;1,300..600&family=Inter+Tight:wght@400;500;600;700&display=swap";

export const metadata: Metadata = {
  title: "Tunzone - B2B Furniture Management",
  description: "Tunzone platform for furniture manufacturers and builders",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href={GOOGLE_FONTS_URL} rel="stylesheet" />
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('tz-admin-theme');if(t!=='light'&&t!=='dark'){var h=new Date().getHours();t=h>=7&&h<19?'light':'dark'}document.documentElement.dataset.theme=t;document.cookie='tz-admin-theme='+t+';path=/;max-age=31536000;SameSite=Lax';}catch(e){}})();` }} />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <GoogleAnalytics />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
