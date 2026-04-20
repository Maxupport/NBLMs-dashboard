import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "NBLMs Manager",
  description: "Centralized workspace for managing and sharing NBLMs projects.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" className="dark">
      <body className={`${inter.className} min-h-screen bg-background text-foreground antialiased`}>
        {children}
        <Toaster theme="dark" position="bottom-right" className="!font-sans" />
      </body>
    </html>
  );
}
