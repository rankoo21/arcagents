"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wallet, LogOut, Zap } from "lucide-react";
import { useWallet } from "../wallet-context";
import { shortAddr } from "../contracts";
import { Spinner } from "./ui/primitives";

const links = [
  { to: "/agents", label: "Agents" },
  { to: "/jobs", label: "Jobs" },
  { to: "/marketplace", label: "Market" },
  { to: "/register", label: "Register Agent" },
  { to: "/create-job", label: "Create Job" },
] as const;

export default function Navbar() {
  const path = usePathname();
  const w = useWallet();
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-background/60 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-info text-white">
            <Zap className="h-4 w-4" />
          </span>
          <span>ArcAgents</span>
        </Link>

        <nav
          className="hidden items-center gap-1 md:flex"
          aria-label="Primary"
        >
          {links.map((l) => (
            <Link
              key={l.to}
              href={l.to}
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-white/5 hover:text-foreground ${
                path === l.to
                  ? "bg-white/5 text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {w.address ? (
            <>
              <span className="hidden rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-xs font-medium text-success sm:inline-flex">
                {parseFloat(w.balance).toFixed(2)} USDC
              </span>
              <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-xs">
                {shortAddr(w.address)}
              </span>
              <button
                onClick={w.disconnect}
                aria-label="Disconnect wallet"
                className="rounded-lg border border-white/10 p-1.5 text-muted-foreground hover:bg-white/5 hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <button
              onClick={w.connect}
              disabled={w.isConnecting}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white shadow-[0_8px_24px_-8px_rgba(108,92,231,0.7)] transition-transform hover:-translate-y-px hover:bg-brand/90 disabled:opacity-60"
            >
              {w.isConnecting ? <Spinner /> : <Wallet className="h-4 w-4" />}
              {w.isConnecting ? "Connecting…" : "Connect Wallet"}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
