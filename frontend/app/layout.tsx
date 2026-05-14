import type { Metadata } from "next";
import "./globals.css";
import { SonnerProvider } from "@/lib/sonner";

export const metadata: Metadata = {
  title: "Aglaea — status & signal",
  description: "Service status, incident history, and Claude Code analytics.",
  icons: {
    icon:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='6' r='2' fill='%23d4a14a'/%3E%3Ccircle cx='6.5' cy='15.5' r='1.7' fill='%23d4a14a'/%3E%3Ccircle cx='17.5' cy='15.5' r='1.7' fill='%23d4a14a'/%3E%3C/svg%3E",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <SonnerProvider />
      </body>
    </html>
  );
}
