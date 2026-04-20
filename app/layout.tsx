import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "NBLM LinkStation | NBLM 連結總站",
  description: "一站式彙整與管理您所有的 NotebookLM 筆記連結，打造最直覺的知識協作中心。Centralized workspace for managing and sharing NBLMs projects.",
  keywords: ["NotebookLM", "NBLM", "筆記彙整", "知識管理", "LinkStation", "Dashboard", "知識中心"],
  authors: [{ name: "Maxupport" }],
  openGraph: {
    title: "NBLM LinkStation | NBLM 連結總站",
    description: "一站式彙整與管理您所有的 NotebookLM 筆記連結。",
    url: "https://nblm-linkstation.vercel.app", // Placeholder or dynamic detection
    siteName: "NBLM LinkStation",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 1200,
        alt: "NBLM LinkStation Preview",
      },
    ],
    locale: "zh_TW",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "NBLM LinkStation | NBLM 連結總站",
    description: "一站式彙整與管理您所有的 NotebookLM 筆記連結。",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/favicon.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" className="dark">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              "name": "NBLM LinkStation",
              "alternateName": "NBLM 連結總站",
              "description": "一站式彙整與管理您所有的 NotebookLM 筆記連結，打造最直覺的知識協作中心。",
              "applicationCategory": "ProductivityApplication",
              "operatingSystem": "All",
              "offers": {
                "@type": "Offer",
                "price": "0"
              }
            })
          }}
        />
      </head>
      <body className={`${inter.className} min-h-screen bg-background text-foreground antialiased`}>
        {children}
        <Toaster theme="dark" position="bottom-right" className="!font-sans" />
      </body>
    </html>
  );
}
