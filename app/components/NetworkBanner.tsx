"use client";
import { AlertTriangle } from "lucide-react";
import { useWallet } from "../wallet-context";
import { arcTestnet } from "../contracts";

export default function NetworkBanner() {
  const { isWrongNetwork, switchNetwork } = useWallet();

  if (!isWrongNetwork) return null;

  return (
    <div className="border-b border-warning/30 bg-warning/10">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 text-sm sm:px-6">
        <div className="flex items-center gap-2 text-warning">
          <AlertTriangle className="h-4 w-4" />
          Wrong network. Please switch to {arcTestnet.name}.
        </div>
        <button
          onClick={switchNetwork}
          className="rounded-md border border-warning/40 px-3 py-1 text-xs font-medium text-warning hover:bg-warning/20"
        >
          Switch to Arc Testnet
        </button>
      </div>
    </div>
  );
}
