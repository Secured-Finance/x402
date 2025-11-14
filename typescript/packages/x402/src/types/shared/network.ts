import { z } from "zod";

export const NetworkSchema = z.enum([
  "abstract",
  "abstract-testnet",
  "sepolia",
  "base-sepolia",
  "base",
  "avalanche-fuji",
  "avalanche",
  "iotex",
  "solana-devnet",
  "solana",
  "sei",
  "sei-testnet",
  "polygon",
  "polygon-amoy",
  "peaq",
  "story",
  "mainnet",
  "filecoin",
  "filecoin-calibration",
]);
export type Network = z.infer<typeof NetworkSchema>;

// evm
export const SupportedEVMNetworks: Network[] = [
  "abstract",
  "abstract-testnet",
  "sepolia",
  "base-sepolia",
  "base",
  "avalanche-fuji",
  "avalanche",
  "iotex",
  "sei",
  "sei-testnet",
  "polygon",
  "polygon-amoy",
  "peaq",
  "story",
  "mainnet",
  "filecoin",
  "filecoin-calibration",
];
export const EvmNetworkToChainId = new Map<Network, number>([
  ["abstract", 2741],
  ["abstract-testnet", 11124],
  ["sepolia", 11155111],
  ["base-sepolia", 84532],
  ["base", 8453],
  ["avalanche-fuji", 43113],
  ["avalanche", 43114],
  ["iotex", 4689],
  ["sei", 1329],
  ["sei-testnet", 1328],
  ["polygon", 137],
  ["polygon-amoy", 80002],
  ["peaq", 3338],
  ["story", 1514],
  ["mainnet", 1],
  ["filecoin", 314],
  ["filecoin-calibration", 314159],
]);

// svm
export const SupportedSVMNetworks: Network[] = ["solana-devnet", "solana"];
export const SvmNetworkToChainId = new Map<Network, number>([
  ["solana-devnet", 103],
  ["solana", 101],
]);

export const ChainIdToNetwork = Object.fromEntries(
  [...SupportedEVMNetworks, ...SupportedSVMNetworks].map(network => [
    EvmNetworkToChainId.get(network),
    network,
  ]),
) as Record<number, Network>;

// Runtime helper to determine testnet vs mainnet for both EVM and SVM networks
const TESTNET_NETWORKS = new Set<Network>([
  "abstract-testnet",
  "sepolia",
  "base-sepolia",
  "avalanche-fuji",
  "solana-devnet",
  "sei-testnet",
  "polygon-amoy",
  "filecoin-calibration",
]);

export function isTestnetNetwork(network: Network): boolean {
  return TESTNET_NETWORKS.has(network);
}
