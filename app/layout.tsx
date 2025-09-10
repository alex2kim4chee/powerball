import "./globals.css";
import { Inter, Unbounded } from "next/font/google";
import type { Metadata, Viewport } from "next";
import Script from "next/script";

// Явно запрашиваем используемые начертания, чтобы избежать синтетического bold/semibold
const inter = Inter({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "600", "700", "800"],
  display: "swap",
  variable: "--font-inter",
});
const unbounded = Unbounded({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "700", "800"],
  display: "swap",
  variable: "--font-unbounded",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://example.com"),
  title: {
    default:
      "PowerBall на русском — купить билет Powerball онлайн, результаты и джекпот",
    template: "%s | PowerBall RU",
  },
  description:
    "PowerBall на русском: купить билет онлайн, посмотреть результаты тиражей и текущий джекпот. Быстрый выбор чисел, безопасная оплата. 18+, играйте ответственно.",
  keywords: [
    "Powerball",
    "Пауэрбол",
    "PowerBall на русском",
    "купить билет Powerball",
    "результаты Powerball",
    "джекпот Powerball",
    "лотерея онлайн",
  ],
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title:
      "PowerBall на русском — купить билет Powerball онлайн, результаты и джекпот",
    description:
      "PowerBall на русском: купить билет онлайн, посмотреть результаты тиражей и текущий джекпот. Быстрый выбор чисел, безопасная оплата. 18+, играйте ответственно.",
    type: "website",
    locale: "ru_RU",
    images: [
      {
        url: "/og.jpg",
        width: 1200,
        height: 630,
        alt: "PowerBall RU — неоновый шар и джекпот",
      },
    ],
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${inter.variable} ${unbounded.variable}`}>
      <head>
        {/* Schema.org: WebSite */}
        <Script id="ld-website" type="application/ld+json" strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "PowerBall RU",
              url: "https://example.com/",
              inLanguage: "ru-RU",
              potentialAction: {
                "@type": "SearchAction",
                target: "https://example.com/search?q={query}",
                "query-input": "required name=query",
              },
            }),
          }}
        />

        {/* Schema.org: LocalBusiness for Yandex with address and category */}
        <Script id="ld-localbusiness" type="application/ld+json" strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "LocalBusiness",
              name: "PowerBall RU",
              url: "https://example.com/",
              image: "https://example.com/og.jpg",
              description:
                "Русскоязычный сервис продажи билетов Powerball онлайн: быстрый выбор чисел, безопасная оплата, результаты тиражей. 18+, играйте ответственно.",
              telephone: undefined,
              address: {
                "@type": "PostalAddress",
                streetAddress: "Молодёжный проезд, 6, район Новокуркино",
                addressLocality: "Химки",
                addressRegion: "Московская область",
                addressCountry: "RU",
              },
              areaServed: "Химки и Московская область",
              priceRange: "₽₽",
              category: "Лотереи, развлечения",
              additionalType: "https://schema.org/EntertainmentBusiness",
            }),
          }}
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
