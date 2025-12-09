/**
 * Settlement Router Commitment Calculation
 *
 * The commitment hash is used as the nonce in ERC-3009 authorization.
 * This ensures that all settlement parameters are cryptographically committed
 * before the user signs, preventing parameter tampering by the facilitator.
 *
 * Reference: /Users/catalyst/work/x402-exec/contracts/src/SettlementRouter.sol
 * Protocol: X402/settle/v1
 */

import { keccak256, encodePacked, type Hex } from 'viem'

/**
 * Parameters for commitment calculation
 */
export interface CommitmentParams {
  /** Network chain ID */
  chainId: number
  /** SettlementRouter contract address */
  router: Hex
  /** ERC-20 token address */
  token: Hex
  /** Payer address */
  from: Hex
  /** Total payment amount (including facilitator fee) */
  value: bigint
  /** EIP-3009 valid after timestamp */
  validAfter: bigint
  /** EIP-3009 expiration timestamp */
  validBefore: bigint
  /** Unique salt (32 bytes) */
  salt: Hex
  /** Final recipient address (merchant) */
  payTo: Hex
  /** Facilitator fee amount */
  facilitatorFee: bigint
  /** Hook contract address */
  hook: Hex
  /** Hook-specific data (empty '0x' for TransferHook) */
  hookData: Hex
}

/**
 * Calculate commitment hash for SettlementRouter
 *
 * The commitment hash is calculated as:
 * keccak256(
 *   "X402/settle/v1",
 *   chainId,
 *   router,
 *   token,
 *   from,
 *   value,
 *   validAfter,
 *   validBefore,
 *   salt,
 *   payTo,
 *   facilitatorFee,
 *   hook,
 *   keccak256(hookData)
 * )
 *
 * This hash must be used as the nonce in ERC-3009 transferWithAuthorization.
 *
 * @param params - Commitment parameters
 * @returns Commitment hash (32 bytes)
 *
 * @example
 * ```typescript
 * const commitment = calculateCommitment({
 *   chainId: 11155111,  // Sepolia
 *   router: '0x...',
 *   token: '0x...',      // USDC
 *   from: userAddress,
 *   value: 1010000n,     // 1.01 USDC (including fee)
 *   validAfter: 0n,
 *   validBefore: BigInt(Date.now() + 3600000),
 *   salt: generateSalt(),
 *   payTo: merchantAddress,
 *   facilitatorFee: 10000n,  // 0.01 USDC
 *   hook: transferHookAddress,
 *   hookData: '0x'
 * })
 *
 * // Use this commitment as the nonce when signing
 * const signature = await signTypedData({
 *   ...
 *   nonce: commitment  // ← Commitment is the nonce
 * })
 * ```
 */
export function calculateCommitment(params: CommitmentParams): Hex {
  // Validate addresses
  if (!params.router || params.router === '0x0000000000000000000000000000000000000000') {
    throw new Error('Invalid router address')
  }
  if (!params.token || params.token === '0x0000000000000000000000000000000000000000') {
    throw new Error('Invalid token address')
  }
  if (!params.from || params.from === '0x0000000000000000000000000000000000000000') {
    throw new Error('Invalid from address')
  }
  if (!params.payTo || params.payTo === '0x0000000000000000000000000000000000000000') {
    throw new Error('Invalid payTo address')
  }
  if (!params.hook || params.hook === '0x0000000000000000000000000000000000000000') {
    throw new Error('Invalid hook address')
  }

  // Validate amounts
  if (params.value <= 0n) {
    throw new Error('Value must be positive')
  }
  if (params.facilitatorFee < 0n) {
    throw new Error('Facilitator fee cannot be negative')
  }
  if (params.facilitatorFee >= params.value) {
    throw new Error('Facilitator fee must be less than value')
  }

  // Validate time window
  if (params.validBefore <= params.validAfter) {
    throw new Error('validBefore must be after validAfter')
  }

  // Calculate hookData hash
  const hookDataHash = keccak256(params.hookData || '0x')

  // Calculate commitment hash
  // Must match SettlementRouter.sol:calculateCommitment() exactly
  return keccak256(
    encodePacked(
      ['string', 'uint256', 'address', 'address', 'address', 'uint256', 'uint256', 'uint256', 'bytes32', 'address', 'uint256', 'address', 'bytes32'],
      [
        'X402/settle/v1',          // Protocol version
        BigInt(params.chainId),    // Chain ID for replay protection
        params.router,              // Router address (cross-router replay protection)
        params.token,               // Token being transferred
        params.from,                // Payer address
        params.value,               // Total amount (including fee)
        params.validAfter,          // EIP-3009 valid after
        params.validBefore,         // EIP-3009 expiration
        params.salt,                // Unique identifier
        params.payTo,               // Final recipient
        params.facilitatorFee,      // Fee amount
        params.hook,                // Hook contract
        hookDataHash                // Hook data hash
      ]
    )
  )
}

/**
 * Generate a random salt (32 bytes)
 *
 * @returns Random 32-byte hex string
 *
 * @example
 * ```typescript
 * const salt = generateSalt()
 * // => '0x1234567890abcdef...'
 * ```
 */
export function generateSalt(): Hex {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return `0x${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')}` as Hex
}

/**
 * Verify commitment matches expected parameters
 *
 * @param commitment - Commitment hash to verify
 * @param params - Expected parameters
 * @returns true if commitment matches, false otherwise
 *
 * @example
 * ```typescript
 * const isValid = verifyCommitment(paymentHeader.nonce, {
 *   chainId: 11155111,
 *   router: config.settlementRouter,
 *   ...
 * })
 *
 * if (!isValid) {
 *   throw new Error('Commitment mismatch - parameters may have been tampered')
 * }
 * ```
 */
export function verifyCommitment(commitment: Hex, params: CommitmentParams): boolean {
  try {
    const expected = calculateCommitment(params)
    return commitment.toLowerCase() === expected.toLowerCase()
  } catch {
    return false
  }
}
