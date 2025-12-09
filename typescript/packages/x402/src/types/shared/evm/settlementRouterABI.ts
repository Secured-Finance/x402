/**
 * SettlementRouter ABI
 * Sourced from x402-exec audited contracts
 *
 * Contract: /Users/catalyst/work/x402-exec/contracts/src/SettlementRouter.sol
 * Version: Audited version
 */

export const SETTLEMENT_ROUTER_ABI = [
  {
    type: 'function',
    name: 'settleAndExecute',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'from', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
      { name: 'signature', type: 'bytes' },
      { name: 'salt', type: 'bytes32' },
      { name: 'payTo', type: 'address' },
      { name: 'facilitatorFee', type: 'uint256' },
      { name: 'hook', type: 'address' },
      { name: 'hookData', type: 'bytes' }
    ],
    outputs: []
  },
  {
    type: 'function',
    name: 'calculateCommitment',
    stateMutability: 'view',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'from', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'salt', type: 'bytes32' },
      { name: 'payTo', type: 'address' },
      { name: 'facilitatorFee', type: 'uint256' },
      { name: 'hook', type: 'address' },
      { name: 'hookData', type: 'bytes' }
    ],
    outputs: [{ name: 'commitment', type: 'bytes32' }]
  },
  {
    type: 'function',
    name: 'calculateContextKey',
    stateMutability: 'pure',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'nonce', type: 'bytes32' }
    ],
    outputs: [{ name: '', type: 'bytes32' }]
  },
  {
    type: 'function',
    name: 'isSettled',
    stateMutability: 'view',
    inputs: [{ name: 'contextKey', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }]
  },
  {
    type: 'function',
    name: 'getPendingFees',
    stateMutability: 'view',
    inputs: [
      { name: 'facilitator', type: 'address' },
      { name: 'token', type: 'address' }
    ],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'claimFees',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'tokens', type: 'address[]' }],
    outputs: []
  },
  {
    type: 'function',
    name: 'setFeeOperator',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'operator', type: 'address' },
      { name: 'approved', type: 'bool' }
    ],
    outputs: []
  },
  {
    type: 'function',
    name: 'isFeeOperator',
    stateMutability: 'view',
    inputs: [
      { name: 'facilitator', type: 'address' },
      { name: 'operator', type: 'address' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  },
  {
    type: 'function',
    name: 'claimFeesFor',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'facilitator', type: 'address' },
      { name: 'tokens', type: 'address[]' },
      { name: 'recipient', type: 'address' }
    ],
    outputs: []
  },
  {
    type: 'event',
    name: 'Settled',
    inputs: [
      { name: 'contextKey', type: 'bytes32', indexed: true },
      { name: 'payer', type: 'address', indexed: true },
      { name: 'token', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'hook', type: 'address', indexed: false },
      { name: 'salt', type: 'bytes32', indexed: false },
      { name: 'payTo', type: 'address', indexed: false },
      { name: 'facilitatorFee', type: 'uint256', indexed: false }
    ]
  },
  {
    type: 'event',
    name: 'HookExecuted',
    inputs: [
      { name: 'contextKey', type: 'bytes32', indexed: true },
      { name: 'hook', type: 'address', indexed: true },
      { name: 'returnData', type: 'bytes', indexed: false }
    ]
  },
  {
    type: 'event',
    name: 'FeeAccumulated',
    inputs: [
      { name: 'facilitator', type: 'address', indexed: true },
      { name: 'token', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false }
    ]
  },
  {
    type: 'event',
    name: 'FeesClaimed',
    inputs: [
      { name: 'facilitator', type: 'address', indexed: true },
      { name: 'token', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false }
    ]
  },
  {
    type: 'event',
    name: 'FeeOperatorSet',
    inputs: [
      { name: 'facilitator', type: 'address', indexed: true },
      { name: 'operator', type: 'address', indexed: true },
      { name: 'approved', type: 'bool', indexed: false }
    ]
  },
  {
    type: 'error',
    name: 'AlreadySettled',
    inputs: [{ name: 'contextKey', type: 'bytes32' }]
  },
  {
    type: 'error',
    name: 'InvalidCommitment',
    inputs: [
      { name: 'expected', type: 'bytes32' },
      { name: 'actual', type: 'bytes32' }
    ]
  },
  {
    type: 'error',
    name: 'TransferFailed',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'expected', type: 'uint256' },
      { name: 'actual', type: 'uint256' }
    ]
  },
  {
    type: 'error',
    name: 'RouterShouldNotHoldFunds',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'balance', type: 'uint256' }
    ]
  },
  {
    type: 'error',
    name: 'HookExecutionFailed',
    inputs: [
      { name: 'hook', type: 'address' },
      { name: 'reason', type: 'bytes' }
    ]
  },
  {
    type: 'error',
    name: 'InvalidOperator',
    inputs: []
  },
  {
    type: 'error',
    name: 'Unauthorized',
    inputs: []
  },
  {
    type: 'error',
    name: 'InsufficientBalanceForRecovery',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'required', type: 'uint256' },
      { name: 'available', type: 'uint256' }
    ]
  }
] as const
