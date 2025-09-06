import "./globals.css";
import { Inter, Unbounded } from "next/font/google";
import type { Metadata, Viewport } from "next";

const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter" });
const unbounded = Unbounded({ subsets: ["latin", "cyrillic"], variable: "--font-unbounded" });

export const metadata: Metadata = {
  metadataBase: new URL("https://example.com"),
  title: {
    default: "PowerBall на русском — купить билет онлайн, следующий тираж сегодня",
    template: "%s | PowerBall RU",
  },
  description:
    "Русскоязычный интерфейс, живой джекпот, безопасная оплата. Выберите числа, купите билет и следите за результатами. 18+, играйте ответственно.",
  openGraph: {
    title: "PowerBall на русском — купить билет онлайн, следующий тираж сегодня",
    description:
      "Русскоязычный интерфейс, живой джекпот, безопасная оплата. Выберите числа, купите билет и следите за результатами. 18+, играйте ответственно.",
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
      <body>
        {children}
      </body>
    </html>
  );
}
