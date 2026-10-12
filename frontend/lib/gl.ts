import { createClient } from "genlayer-js";

export const ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "") as `0x${string}`;
export const CHAIN: any = {
  id: 61997, name: "GenLayer Studio Next",
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
  rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_RPC_URL || "https://studio-next.genlayer.com/api"] } },
  blockExplorers: { default: { name: "Explorer", url: "https://explorer-studio-dev.genlayer.com/" } },
};
const eth = () => (window as any).ethereum;

export async function connect(): Promise<string> {
  const [a] = await eth().request({ method: "eth_requestAccounts" });
  const chainId = "0x" + CHAIN.id.toString(16);
  try {
    await eth().request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
  } catch {
    await eth().request({ method: "wallet_addEthereumChain", params: [{ chainId, chainName: CHAIN.name, nativeCurrency: CHAIN.nativeCurrency, rpcUrls: CHAIN.rpcUrls.default.http, blockExplorerUrls: [CHAIN.blockExplorers.default.url] }] });
  }
  return a.toLowerCase();
}
export async function read(fn: string, args: any[] = []) {
  const c: any = createClient({ chain: CHAIN });
  return c.readContract({ address: ADDRESS, functionName: fn, args });
}
export async function write(account: string, fn: string, args: any[], value = BigInt(0)) {
  const c: any = createClient({ chain: CHAIN, account: account as any });
  const hash = await c.writeContract({ address: ADDRESS, functionName: fn, args, value });
  return c.waitForTransactionReceipt({ hash, status: "ACCEPTED", retries: 200 });
}
export const toWei = (g: string) => BigInt(Math.round(parseFloat(g || "0") * 1e6)) * BigInt("1000000000000");
export const fromWei = (w: string | bigint) => (Number(BigInt(w) / BigInt("1000000000000")) / 1e6).toString();
