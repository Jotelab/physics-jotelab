import type { Metadata } from "next";
import { Baloo_2, Geist, Geist_Mono, Mitr, Noto_Sans_Thai } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoSansThai = Noto_Sans_Thai({
  variable: "--font-noto-sans-thai",
  subsets: ["thai", "latin"],
});

/* Heading pair: Baloo 2 covers Latin; Thai glyphs fall through to Mitr via
   the --font-heading stack in globals.css. Body faces are unchanged. */
const baloo = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin"],
});

const mitr = Mitr({
  variable: "--font-mitr",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");

  return {
    title: {
      default: t("defaultTitle"),
      template: "%s | PhysicsJotelab",
    },
    description: t("defaultDescription"),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();
  const isThai = locale === "th";

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${notoSansThai.variable} ${baloo.variable} ${mitr.variable} h-full antialiased`}
    >
      <body
        className={`min-h-full flex flex-col ${isThai ? "font-[family-name:var(--font-noto-sans-thai)]" : ""}`}
      >
        <ThemeProvider>
          <NextIntlClientProvider locale={locale} messages={messages}>
            {children}
          </NextIntlClientProvider>
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
