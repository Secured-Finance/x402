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
   * Minimum fee in USD (0.01 USD = 1 cent)
   * Applied when percentage fee would be less than this amount
   * This is converted to atomic units based on token decimals
   */
  MIN_FEE_USD: 0.01,
} as const;

/**
 * Calculate facilitator fee for a given total amount
 *
 * @param totalAmount - Total payment amount in atomic units
 * @param decimals - Token decimals (6 for USDC, 18 for JPYC/USDFC)
 * @returns Object containing fee amount and merchant amount
 *
 * @example
 * ```typescript
 * // USDC (6 decimals)
 * const { feeAmount, merchantAmount } = calculateFee(BigInt(1000000), 6); // 1.00 USDC
 * // feeAmount: 10000n (0.01 USDC - minimum fee applies)
 * // merchantAmount: 990000n (0.99 USDC)
 *
 * // JPYC (18 decimals)
 * const { feeAmount, merchantAmount } = calculateFee(BigInt("1000000000000000000"), 18); // 1.00 JPYC
 * // feeAmount: 10000000000000000n (0.01 JPYC - minimum fee applies)
 * // merchantAmount: 990000000000000000n (0.99 JPYC)
 * ```
 */
export function calculateFee(
  totalAmount: bigint,
  decimals: number,
): {
  feeAmount: bigint;
  merchantAmount: bigint;
} {
  const { FEE_BASIS_POINTS, BASIS_POINTS_DIVISOR, MIN_FEE_USD } = FEE_CONFIG;

  // Calculate 0.3% fee
  const percentFee = (totalAmount * FEE_BASIS_POINTS) / BASIS_POINTS_DIVISOR;

  // Calculate minimum fee in atomic units based on token decimals
  // MIN_FEE_USD = 0.01 USD
  // For 6 decimals: 0.01 * 10^6 = 10000
  // For 18 decimals: 0.01 * 10^18 = 10000000000000000
  const minFeeAtomic = BigInt(Math.floor(MIN_FEE_USD * 10 ** decimals));

  // Apply minimum fee if percentage is too small
  const feeAmount = percentFee > minFeeAtomic ? percentFee : minFeeAtomic;

  // Remaining amount goes to merchant
  const merchantAmount = totalAmount - feeAmount;

  return { feeAmount, merchantAmount };
}

/**
 * Converts a USD amount to atomic units for a specific token
 *
 * This function:
 * 1. Converts USD to token amount using exchange rate (e.g., $0.01 → ~1.56 JPYC)
 * 2. Converts token amount to atomic units using decimals
 *
 * Uses string manipulation to avoid floating point precision issues.
 *
 * @param usdAmount - The USD amount to convert (e.g., 0.01 for $0.01)
 * @param decimals - The number of decimals for the token (6 for USDC, 18 for JPYC/USDFC)
 * @param tokenSymbol - The token symbol (USDC, JPYC, USDFC) - defaults to USDC
 * @returns The atomic units as a string
 *
 * @example
 * ```typescript
 * // USDC (6 decimals, 1 USDC = $1 USD)
 * usdToAtomic(0.01, 6, 'USDC'); // "10000" (0.01 USDC)
 *
 * // JPYC (18 decimals, 1 JPYC ≈ $0.0064 USD)
 * usdToAtomic(0.01, 18, 'JPYC'); // "1562500000000000000" (~1.5625 JPYC)
 *
 * // USDFC (18 decimals, 1 USDFC ≈ $0.9965 USD)
 * usdToAtomic(0.01, 18, 'USDFC'); // "10035087719298245" (~0.01004 USDFC)
 * ```
 */
export function usdToAtomic(
  usdAmount: number,
  decimals: number,
  tokenSymbol: string = "USDC",
): string {
  // Get exchange rate for this token (defaults to 1.0 for unknown tokens)
  const rate = TOKEN_USD_RATES[tokenSymbol] || 1.0;

  // Convert USD to token amount (e.g., $0.01 / $0.0064 per JPYC = 1.5625 JPYC)
  const tokenAmount = usdAmount / rate;

  // Convert token amount to atomic units
  // Use string manipulation to avoid floating point precision issues
  const parts = tokenAmount.toString().split(".");
  const whole = parts[0];
  const fractional = parts[1] ?? "";

  // Pad or truncate fractional part to match token decimals
  const padded = fractional.padEnd(decimals, "0").slice(0, decimals);
  const atomic = whole + padded;
  return BigInt(atomic).toString();
}

/**
 * Token to USD Exchange Rates
 *
 * These rates are used to convert USD prices to token amounts.
 * IMPORTANT: Update these periodically to reflect current market rates.
 *
 * Sources (as of 2025-01-20):
 * - USDC: Pegged to $1 USD
 * - USDFC: ~$0.9965 USD (Filecoin Community stablecoin)
 * - JPYC: ~$0.0064 USD (1 JPYC ≈ ¥1 JPY, exchange rate ~156 JPY/USD)
 */
export const TOKEN_USD_RATES: Record<string, number> = {
  USDC: 1.0,
  USDFC: 0.9965,
  JPYC: 0.0064,
} as const;

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
