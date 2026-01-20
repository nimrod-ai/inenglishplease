import "./globals.css";
import { Fraunces, Space_Grotesk } from "next/font/google";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap"
});

const body = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap"
});

export const metadata = {
  title: "In English, Please",
  description: "Plain-language business summaries with zero fluff."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="font-body text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
