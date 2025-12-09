/**
 * Fee Claiming for SettlementRouter
 *
 * Facilitators accumulate fees in the SettlementRouter contract.
 * This module provides functions to query and claim those fees.
 */

import { Address, Chain, Transport } from "viem";
import { SignerWallet } from "../../../types/shared/evm";
import { SETTLEMENT_ROUTER_ABI } from "../../../types/shared/evm/settlementRouterABI";
import { getNetworkId } from "../../../shared";
import { config as networkConfig } from "../../../types/shared/evm/config";

/**
 * Get pending fees for a facilitator on a specific network
 *
 * @param facilitatorAddress - The facilitator wallet address
 * @param tokens - Array of token addresses to check
 * @param network - Network name (e.g., 'sepolia', 'base')
 * @param wallet - Wallet client for reading contract
 * @returns Map of token address to pending fee amount
 *
 * @example
 * ```typescript
 * const fees = await getPendingFees(
 *   facilitatorAddress,
 *   [usdcAddress, jpycAddress],
 *   'sepolia',
 *   wallet
 * );
 *
 * console.log(`USDC fees: ${fees.get(usdcAddress)}`);
 * ```
 */
export async function getPendingFees<transport extends Transport, chain extends Chain>(
  facilitatorAddress: Address,
  tokens: Address[],
  network: string,
  wallet: SignerWallet<chain, transport>
): Promise<Map<Address, bigint>> {
  const chainId = getNetworkId(network);
  const chainConfig = networkConfig[chainId.toString()];

  if (!chainConfig?.settlementRouter) {
    throw new Error(`SettlementRouter not configured for network ${network}`);
  }

  const settlementRouter = chainConfig.settlementRouter as Address;
  const fees = new Map<Address, bigint>();

  for (const token of tokens) {
    const amount = await wallet.readContract({
      address: settlementRouter,
      abi: SETTLEMENT_ROUTER_ABI,
      functionName: "getPendingFees",
      args: [facilitatorAddress, token],
    });

    fees.set(token, amount);
  }

  return fees;
}

/**
 * Claim accumulated fees from SettlementRouter
 *
 * @param tokens - Array of token addresses to claim fees for
 * @param network - Network name (e.g., 'sepolia', 'base')
 * @param wallet - Wallet client for submitting transaction
 * @returns Transaction hash
 *
 * @example
 * ```typescript
 * // Claim fees for USDC and JPYC on Sepolia
 * const txHash = await claimFees(
 *   [usdcAddress, jpycAddress],
 *   'sepolia',
 *   facilitatorWallet
 * );
 *
 * console.log(`Fees claimed: ${txHash}`);
 * ```
 */
export async function claimFees<transport extends Transport, chain extends Chain>(
  tokens: Address[],
  network: string,
  wallet: SignerWallet<chain, transport>
): Promise<`0x${string}`> {
  const chainId = getNetworkId(network);
  const chainConfig = networkConfig[chainId.toString()];

  if (!chainConfig?.settlementRouter) {
    throw new Error(`SettlementRouter not configured for network ${network}`);
  }

  const settlementRouter = chainConfig.settlementRouter as Address;

  // Filter tokens to only claim those with non-zero fees
  const facilitatorAddress = wallet.account!.address;
  const pendingFees = await getPendingFees(facilitatorAddress, tokens, network, wallet);

  const claimableTokens = tokens.filter(token => {
    const amount = pendingFees.get(token) || 0n;
    return amount > 0n;
  });

  if (claimableTokens.length === 0) {
    throw new Error('No fees to claim');
  }

  // Call claimFees on SettlementRouter
  const tx = await wallet.writeContract({
    address: settlementRouter,
    abi: SETTLEMENT_ROUTER_ABI,
    functionName: "claimFees",
    args: [claimableTokens],
    chain: wallet.chain as Chain,
  });

  return tx;
}

/**
 * Get total pending fees in USD equivalent
 *
 * Useful for displaying total claimable amount to facilitators
 *
 * @param facilitatorAddress - The facilitator wallet address
 * @param tokens - Array of token addresses with their decimals
 * @param network - Network name
 * @param wallet - Wallet client
 * @returns Total fees in USD (as a number, not wei)
 */
export async function getTotalPendingFeesUSD<transport extends Transport, chain extends Chain>(
  facilitatorAddress: Address,
  tokens: Array<{ address: Address; decimals: number; usdRate?: number }>,
  network: string,
  wallet: SignerWallet<chain, transport>
): Promise<number> {
  const tokenAddresses = tokens.map(t => t.address);
  const fees = await getPendingFees(facilitatorAddress, tokenAddresses, network, wallet);

  let totalUSD = 0;

  for (const token of tokens) {
    const feeWei = fees.get(token.address) || 0n;
    const feeAmount = Number(feeWei) / (10 ** token.decimals);
    const usdRate = token.usdRate || 1.0; // Default to $1 if not provided
    totalUSD += feeAmount * usdRate;
  }

  return totalUSD;
}
