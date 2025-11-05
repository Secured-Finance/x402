import { Address } from "viem";
import { Address as SolanaAddress } from "@solana/kit";
import type { Network } from "../network";

/**
 * Network Configuration for x402 Payment Protocol
 *
 * This config defines supported tokens and contract addresses for each blockchain network.
 * Each network can support multiple payment tokens (USDC, JPYC, USDFC).
 *
 * FeeReceiver Contract:
 * - Automatically splits payments: 0.3% fee (min $0.01) to facilitator, rest to merchant
 * - Currently deployed on: Sepolia (testnet), Filecoin Calibration (testnet)
 * - For production: Deploy FeeReceiver to mainnet networks before going live
 *
 * JPYC Token Addresses:
 * - Current addresses may be placeholders and need verification before mainnet use
 * - Verify with JPYC team before enabling on production networks
 *
 * Supported Networks:
 * - Testnets: Sepolia (USDC, JPYC + FeeReceiver), Filecoin Calibration (USDFC + FeeReceiver)
 * - Mainnets: Ethereum, Base, Polygon, Avalanche, Filecoin (FeeReceiver not yet deployed)
 * - Solana: Devnet and Mainnet (USDC support)
 */
export const config: Record<string, ChainConfig> = {
  // Base Sepolia (Testnet)
  "84532": {
    usdcAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    usdcName: "USDC",
    blockExplorer: "https://sepolia.basescan.org",
  },
  // Base (Mainnet)
  "8453": {
    usdcAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    usdcName: "USD Coin",
    blockExplorer: "https://basescan.org",
  },
  // Sepolia (Testnet) - PRODUCTION READY with FeeReceiver
  "11155111": {
    usdcAddress: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    usdcName: "USDC",
    jpycAddress: "0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29",
    jpycName: "JPYC",
    feeReceiverAddress: "0x0d06F661a4fCB8CF357dCc40b0938eD1f6aC7172", // ✅ Deployed
    blockExplorer: "https://sepolia.etherscan.io",
  },
  // Ethereum Mainnet - FeeReceiver not yet deployed
  "1": {
    usdcAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    usdcName: "USDC",
    jpycAddress: "0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29", // TODO: Verify JPYC address
    jpycName: "JPYC",
    blockExplorer: "https://etherscan.io",
  },
  "43113": {
    usdcAddress: "0x5425890298aed601595a70AB815c96711a31Bc65",
    usdcName: "USD Coin",
    jpycAddress: "0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29",
    jpycName: "JPYC",
  },
  "43114": {
    usdcAddress: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
    usdcName: "USD Coin",
    jpycAddress: "0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29",
    jpycName: "JPYC",
  },
  "4689": {
    usdcAddress: "0xcdf79194c6c285077a58da47641d4dbe51f63542",
    usdcName: "Bridged USDC",
  },
  // solana devnet
  "103": {
    usdcAddress: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU" as SolanaAddress,
    usdcName: "USDC",
  },
  // solana mainnet
  "101": {
    usdcAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" as SolanaAddress,
    usdcName: "USDC",
  },
  "1328": {
    usdcAddress: "0x4fcf1784b31630811181f670aea7a7bef803eaed",
    usdcName: "USDC",
  },
  "1329": {
    usdcAddress: "0xe15fc38f6d8c56af07bbcbe3baf5708a2bf42392",
    usdcName: "USDC",
  },
  "137": {
    usdcAddress: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359",
    usdcName: "USD Coin",
    jpycAddress: "0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29",
    jpycName: "JPYC",
  },
  "80002": {
    usdcAddress: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
    usdcName: "USDC",
    jpycAddress: "0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29",
    jpycName: "JPYC",
  },
  "3338": {
    usdcAddress: "0xbbA60da06c2c5424f03f7434542280FCAd453d10",
    usdcName: "USDC",
  },
  "2741": {
    usdcAddress: "0x84a71ccd554cc1b02749b35d22f684cc8ec987e1",
    usdcName: "Bridged USDC",
  },
  "11124": {
    usdcAddress: "0xe4C7fBB0a626ed208021ccabA6Be1566905E2dFc",
    usdcName: "Bridged USDC",
  },
  "1514": {
    usdcAddress: "0xF1815bd50389c46847f0Bda824eC8da914045D14",
    usdcName: "Bridged USDC",
  },
  // Filecoin (Mainnet) - FeeReceiver not yet deployed
  "314": {
    usdfcAddress: "0x80B98d3aa09ffff255c3ba4A241111Ff1262F045",
    usdfcName: "USDFC",
    blockExplorer: "https://filfox.info/en",
  },
  // Filecoin Calibration (Testnet) - PRODUCTION READY with FeeReceiver
  "314159": {
    usdfcAddress: "0xb3042734b608a1B16e9e86B374A3f3e389B4cDf0",
    usdfcName: "USD for Filecoin Community",
    feeReceiverAddress: "0x34a6A7D8d7f8C9F2369b7404904DA943C519Ab13", // ✅ Deployed
    blockExplorer: "https://filecoin.blockscout.com",
  },
};

export type ChainConfig = {
  usdcAddress?: Address | SolanaAddress;
  usdcName?: string;
  jpycAddress?: Address;
  jpycName?: string;
  usdfcAddress?: Address;
  usdfcName?: string;
  feeReceiverAddress?: Address;
  blockExplorer?: string;
};

/**
 * Get block explorer URL for a transaction on a specific network
 * @param network - The network name (e.g., "sepolia", "filecoin-calibration")
 * @param txHash - The transaction hash
 * @returns Full URL to view the transaction, or empty string if explorer not configured
 */
export function getExplorerUrl(network: Network, txHash: string): string {
  const NETWORK_TO_CHAIN_ID: Record<string, string> = {
    "sepolia": "11155111",
    "mainnet": "1",
    "base": "8453",
    "base-sepolia": "84532",
    "polygon": "137",
    "polygon-amoy": "80002",
    "avalanche": "43114",
    "avalanche-fuji": "43113",
    "filecoin": "314",
    "filecoin-calibration": "314159",
  };

  const chainId = NETWORK_TO_CHAIN_ID[network];
  if (!chainId) return "";

  const chainConfig = config[chainId];
  if (!chainConfig?.blockExplorer) return "";

  return `${chainConfig.blockExplorer}/tx/${txHash}`;
}
