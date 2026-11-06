import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { GlobalLoaderProvider } from "@/components/ui/loader";
import { Suspense } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Secura — AI Security & Secret Gate",
  description:
    "AI-powered code security platform for detecting exposed secrets and automated PR merge gates.",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var t = localStorage.getItem('secura_theme');
                  if (t === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full bg-slate-50 dark:bg-[#111113] text-slate-900 dark:text-zinc-100 selection:bg-[#EDE9E6] selection:text-[#281C59] dark:selection:bg-zinc-800 dark:selection:text-zinc-200" suppressHydrationWarning>
        <ThemeProvider>
          <Suspense fallback={null}>
            <GlobalLoaderProvider>
              {children}
            </GlobalLoaderProvider>
          </Suspense>
        </ThemeProvider>
      </body>
    </html>
  );
}
