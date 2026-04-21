import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "NBLMs LinkStation | NBLM 連結總站",
  description: "一站式彙整與管理您所有的 NotebookLM 筆記連結。打造最直覺的知識協作中心，讓團隊存取、分享與追蹤筆記變得前所未有的簡單。",
  keywords: ["NotebookLM", "NBLM", "筆記彙整", "知識管理", "LinkStation", "連結總站", "數位書櫃"],
  authors: [{ name: "Nathan & Maxupport" }],
  openGraph: {
    title: "NBLMs LinkStation | NBLM 連結總站",
    description: "快速彙整與管理您所有的 NotebookLM 筆記連結。打造一站式知識協作中心。",
    url: "https://nblm-linkstation.vercel.app", // Placeholder or dynamic detection
    siteName: "NBLMs LinkStation",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 1200,
        alt: "NBLMs LinkStation Preview",
      },
    ],
    locale: "zh_TW",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "NBLMs LinkStation | NBLM 連結總站",
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
              "name": "NBLMs LinkStation",
              "alternateName": "NBLM 連結總站",
              "description": "NBLMs LinkStation 是一款專為管理數位知識筆記而設計的入口站台，旨在消除繁瑣的連結尋找過程，提供結構化的筆記存取與導向服務。",
              "applicationCategory": "ProductivityApplication",
              "operatingSystem": "All",
              "author": {
                 "@type": "Organization",
                 "name": "Nathan & Maxupport"
              },
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
