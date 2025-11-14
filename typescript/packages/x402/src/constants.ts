/**
 * @file Constants used across the x402 protocol
 *
 * IMPORTANT: Fee calculation constants must remain in sync with the FeeReceiver.sol contract
 * See: /FeeReceiver.sol lines 80-83
 */

/**
 * Fee Configuration
 *
 * The facilitator fee is calculated as: max(MIN_FEE_ATOMIC, totalAmount * FEE_BASIS_POINTS / BASIS_POINTS_DIVISOR)
 * This results in a 0.3% fee with a minimum of 0.01 tokens (10000 atomic units for 6 decimals)
 *
 * CRITICAL: These values MUST match the FeeReceiver.sol contract implementation:
 * - Solidity: `uint256 fee = (totalAmount * 3) / 1000;` (0.3%)
 * - Solidity: `uint256 minFee = 10 ** 4;` (0.01 USDC with 6 decimals)
 */
export const FEE_CONFIG = {
  /**
   * Fee basis points (0.3% = 3/1000)
   * Used to calculate percentage-based fee
   */
  FEE_BASIS_POINTS: 3n,

  /**
   * Basis points divisor (1000 for 0.1% precision)
   * FEE_BASIS_POINTS / BASIS_POINTS_DIVISOR = 0.3%
   */
  BASIS_POINTS_DIVISOR: 1000n,

  /**
   * Minimum fee in atomic units (0.01 tokens with 6 decimals = 10000 atomic units)
   * Applied when percentage fee would be less than this amount
   *
   * For 6 decimal tokens (USDC): 10000 = 0.01 USDC
   * For 18 decimal tokens: Would need to be adjusted
   */
  MIN_FEE_ATOMIC: 10000n,

  /**
   * Expected token decimals (USDC standard)
   * This is informational - the actual fee calculation uses atomic units
   */
  EXPECTED_TOKEN_DECIMALS: 6,
} as const;

/**
 * Calculate facilitator fee for a given total amount
 *
 * @param totalAmount - Total payment amount in atomic units
 * @returns Object containing fee amount and merchant amount
 *
 * @example
 * ```typescript
 * const { feeAmount, merchantAmount } = calculateFee(BigInt(1000000)); // 1.00 USDC
 * // feeAmount: 10000n (0.01 USDC - minimum fee applies)
 * // merchantAmount: 990000n (0.99 USDC)
 * ```
 */
export function calculateFee(totalAmount: bigint): {
  feeAmount: bigint;
  merchantAmount: bigint;
} {
  const { FEE_BASIS_POINTS, BASIS_POINTS_DIVISOR, MIN_FEE_ATOMIC } = FEE_CONFIG;

  // Calculate 0.3% fee
  const percentFee = (totalAmount * FEE_BASIS_POINTS) / BASIS_POINTS_DIVISOR;

  // Apply minimum fee if percentage is too small
  const feeAmount = percentFee > MIN_FEE_ATOMIC ? percentFee : MIN_FEE_ATOMIC;

  // Remaining amount goes to merchant
  const merchantAmount = totalAmount - feeAmount;

  return { feeAmount, merchantAmount };
}

/**
 * Default timeout for payment requirements (in seconds)
 * This is the maximum time a payment can be used before expiring
 */
export const DEFAULT_PAYMENT_TIMEOUT_SECONDS = 60;

/**
 * x402 Protocol version
 */
export const X402_VERSION = 1;

/**
 * Network-related constants
 */
export const NETWORK_CONSTANTS = {
  /**
   * Default RPC timeout in milliseconds
   */
  RPC_TIMEOUT_MS: 30000,

  /**
   * Default gas limit buffer (percentage above estimated gas)
   */
  GAS_LIMIT_BUFFER_PERCENT: 20,
} as const;
