"use client";
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import {
  createWalletClient,
  custom,
  formatUnits,
  type Address,
  type WalletClient,
} from "viem";
import {
  arcTestnet,
  publicClient,
  USDC_ADDRESS,
  USDC_DECIMALS,
  erc20Abi,
  ARC_CHAIN_ID,
  ARC_CHAIN_ID_HEX,
  ARC_RPC_URL,
  ARC_EXPLORER,
} from "./contracts";

interface WalletState {
  address: Address | null;
  balance: string;
  chainId: number | null;
  isWrongNetwork: boolean;
  walletClient: WalletClient | null;
  isConnecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
  switchNetwork: () => Promise<void>;
}

const WalletContext = createContext<WalletState>({
  address: null,
  balance: "0",
  chainId: null,
  isWrongNetwork: false,
  walletClient: null,
  isConnecting: false,
  error: null,
  connect: async () => {},
  disconnect: () => {},
  refreshBalance: async () => {},
  switchNetwork: async () => {},
});

export const useWallet = () => useContext(WalletContext);

type Eip1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, cb: (...args: unknown[]) => void) => void;
};

function getEthereum(): Eip1193 | undefined {
  return (window as unknown as { ethereum?: Eip1193 }).ethereum;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<Address | null>(null);
  const [balance, setBalance] = useState("0");
  const [chainId, setChainId] = useState<number | null>(null);
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async (addr: Address) => {
    try {
      const bal = await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [addr],
      });
      setBalance(formatUnits(bal, USDC_DECIMALS));
    } catch {
      setBalance("0");
    }
  }, []);

  const refreshBalance = useCallback(async () => {
    if (address) await fetchBalance(address);
  }, [address, fetchBalance]);

  const switchToArc = useCallback(async () => {
    const eth = getEthereum();
    if (!eth) return;

    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: ARC_CHAIN_ID_HEX }],
      });
      setChainId(ARC_CHAIN_ID);
    } catch (switchErr: unknown) {
      const err = switchErr as { code?: number };
      if (err.code === 4902) {
        await eth.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: ARC_CHAIN_ID_HEX,
              chainName: arcTestnet.name,
              nativeCurrency: arcTestnet.nativeCurrency,
              rpcUrls: [ARC_RPC_URL],
              blockExplorerUrls: [ARC_EXPLORER],
            },
          ],
        });
        setChainId(ARC_CHAIN_ID);
      }
    }
  }, []);

  const switchNetwork = useCallback(async () => {
    setError(null);
    try {
      await switchToArc();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || "Failed to switch network");
    }
  }, [switchToArc]);

  const connect = useCallback(async () => {
    const eth = getEthereum();
    if (!eth) {
      setError("Install MetaMask to connect");
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      await switchToArc();

      // Ask MetaMask to (re)show the account picker so the user can choose
      // which account to connect — even if a site permission already exists.
      try {
        await eth.request({
          method: "wallet_requestPermissions",
          params: [{ eth_accounts: {} }],
        });
      } catch {
        // Some wallets don't support this; fall through to eth_requestAccounts.
      }

      const accounts = (await eth.request({
        method: "eth_requestAccounts",
      })) as string[];

      const addr = accounts[0] as Address;
      const client = createWalletClient({
        account: addr,
        chain: arcTestnet,
        transport: custom({
          request: (args) =>
            eth.request(args as { method: string; params?: unknown[] }),
        }),
      });

      // User explicitly connected — clear the "manually disconnected" flag.
      try {
        localStorage.removeItem("wallet_disconnected");
      } catch {
        /* ignore */
      }

      setAddress(addr);
      setWalletClient(client);
      try {
        const cid = (await eth.request({ method: "eth_chainId" })) as string;
        setChainId(parseInt(cid, 16));
      } catch {
        setChainId(ARC_CHAIN_ID);
      }
      await fetchBalance(addr);

      // Listen for account / chain changes
      eth.on?.("accountsChanged", (accs: unknown) => {
        const newAccs = accs as string[];
        if (newAccs.length === 0) {
          setAddress(null);
          setWalletClient(null);
          setBalance("0");
        } else {
          const newAddr = newAccs[0] as Address;
          setAddress(newAddr);
          // rebuild the wallet client bound to the new account
          setWalletClient(
            createWalletClient({
              account: newAddr,
              chain: arcTestnet,
              transport: custom({
                request: (args) =>
                  eth.request(
                    args as { method: string; params?: unknown[] }
                  ),
              }),
            })
          );
          fetchBalance(newAddr);
        }
      });
      eth.on?.("chainChanged", (cid: unknown) => {
        setChainId(parseInt(cid as string, 16));
      });
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || "Failed to connect");
    } finally {
      setIsConnecting(false);
    }
  }, [switchToArc, fetchBalance]);

  const disconnect = useCallback(() => {
    // Remember the manual disconnect so we don't silently auto-reconnect.
    try {
      localStorage.setItem("wallet_disconnected", "1");
    } catch {
      /* ignore */
    }
    setAddress(null);
    setWalletClient(null);
    setBalance("0");
    setChainId(null);
    setError(null);
  }, []);

  // Auto-connect only if previously authorized AND not manually disconnected.
  useEffect(() => {
    const eth = getEthereum();
    if (!eth) return;

    let manuallyDisconnected = false;
    try {
      manuallyDisconnected =
        localStorage.getItem("wallet_disconnected") === "1";
    } catch {
      /* ignore */
    }
    if (manuallyDisconnected) return;

    eth.request({ method: "eth_accounts" }).then((accs) => {
      const accounts = accs as string[];
      if (accounts.length > 0) {
        connect();
      }
    });
  }, [connect]);

  const isWrongNetwork = address !== null && chainId !== null && chainId !== ARC_CHAIN_ID;

  return (
    <WalletContext.Provider
      value={{
        address,
        balance,
        chainId,
        isWrongNetwork,
        walletClient,
        isConnecting,
        error,
        connect,
        disconnect,
        refreshBalance,
        switchNetwork,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}
