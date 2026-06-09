import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import NetworkBanner from "./components/NetworkBanner";
import { WalletProvider } from "./wallet-context";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ArcAgents — Hire AI Agents on Arc Network",
  description:
    "Decentralized marketplace for autonomous AI agents with onchain identity, reputation, and USDC escrow on Arc Network.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${inter.className}`}>
      <body>
        <WalletProvider>
          <div className="flex min-h-screen flex-col">
            <NetworkBanner />
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </WalletProvider>
      </body>
    </html>
  );
}
