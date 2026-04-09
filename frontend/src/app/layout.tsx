import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { CurrencyProvider } from "@/lib/currency";
import { ScannerPreferencesProvider } from "@/lib/scanner-preferences";
import "./globals.css";

const inter = Inter({
    variable: "--font-inter",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "TickFlow — BTC Arbitrage Dashboard",
    description: "Real-time BTC cross-exchange arbitrage detection, execution, and performance tracking system",
};

export const viewport: Viewport = {
    themeColor: "#0f172a",
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className={`${inter.variable} font-sans antialiased`}>
                <CurrencyProvider>
                    <ScannerPreferencesProvider>{children}</ScannerPreferencesProvider>
                </CurrencyProvider>
            </body>
        </html>
    );
}
