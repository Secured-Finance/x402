# @secured-finance/sf-x402

Core TypeScript implementation of the x402 Payment Protocol. This package provides the foundational types, schemas, and utilities that power all x402 integrations with support for multiple tokens (USDC, JPYC, USDFC) across EVM and Solana networks.

## Features

- **Multi-Token Support**: USDC, JPYC (Japanese Yen Coin), USDFC (USD for Filecoin Community)
- **Multi-Network**: 16+ networks including Ethereum, Base, Polygon, Avalanche, Filecoin, and Solana
- **Automatic Fee Splitting**: FeeReceiver contracts automatically split payments (0.3% platform fee, minimum $0.01)
- **Gasless Transfers**: EIP-3009 `transferWithAuthorization` and `receiveWithAuthorization` support
- **Type-Safe**: Full TypeScript support with comprehensive type definitions
- **Flexible Integration**: Works with Express, Hono, Next.js, or custom implementations

## Installation

```bash
npm install @secured-finance/sf-x402
```

**For GitHub Packages**, add to your `.npmrc`:
```
@secured-finance:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

## Supported Networks

| Network | Chain ID | Testnet | Tokens |
|---------|----------|---------|--------|
| Ethereum Mainnet | 1 | No | USDC, JPYC |
| Sepolia | 11155111 | Yes | USDC, JPYC |
| Base | 8453 | No | USDC |
| Base Sepolia | 84532 | Yes | USDC |
| Polygon | 137 | No | USDC, JPYC |
| Polygon Amoy | 80002 | Yes | USDC, JPYC |
| Avalanche | 43114 | No | USDC, JPYC |
| Avalanche Fuji | 43113 | Yes | USDC, JPYC |
| Filecoin | 314 | No | USDFC |
| Filecoin Calibration | 314159 | Yes | USDFC |
| Solana Mainnet | 101 | No | USDC |
| Solana Devnet | 103 | Yes | USDC |

## Supported Tokens

| Token | Symbol | Decimals | Networks |
|-------|--------|----------|----------|
| USD Coin | USDC | 6 | All EVM networks, Solana |
| JPY Coin | JPYC | 18 | Ethereum, Polygon, Avalanche, Sepolia |
| USD for Filecoin Community | USDFC | 18 | Filecoin, Filecoin Calibration |

### Token Addresses

**USDC on Sepolia**: `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`
**JPYC on Sepolia**: `0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29`
**USDFC on Filecoin Calibration**: `0xb3042734b608a1B16e9e86B374A3f3e389B4cDf0`

*See [config.ts](./src/types/shared/evm/config.ts) for complete address list*

## FeeReceiver Contracts

Automatically deployed on testnets to split payments:
- **0.3% platform fee** (minimum $0.01 in equivalent token)
- Remainder goes to merchant
- Deployed on: Sepolia, Filecoin Calibration

**Sepolia FeeReceiver**: `0x0d06F661a4fCB8CF357dCc40b0938eD1f6aC7172`
**Filecoin Calibration FeeReceiver**: `0x34a6A7D8d7f8C9F2369b7404904DA943C519Ab13`

## Integration Packages

This core package is used by the following integration packages:

- [`@secured-finance/sf-x402-express`](../x402-express): Express.js middleware
- [`@secured-finance/sf-x402-hono`](../x402-hono): Hono middleware
- [`@secured-finance/sf-x402-next`](../x402-next): Next.js middleware
- [`@secured-finance/sf-x402-fetch`](../x402-fetch): Fetch API wrapper
- [`@secured-finance/sf-x402-axios`](../x402-axios): Axios interceptor

## Quick Start

### Client-Side Payment

```typescript
import { exact } from "@secured-finance/sf-x402/schemes";
import { useWalletClient } from "wagmi";

// Create payment header
const walletClient = useWalletClient();
const paymentHeader = await exact.evm.createPaymentHeader(
  walletClient,
  1, // x402 version
  paymentRequirements // from 402 response
);

// Make request with payment
const response = await fetch(url, {
  headers: {
    "X-PAYMENT": paymentHeader,
  },
});
```

### Facilitator Verification

```typescript
import { exact } from "@secured-finance/sf-x402/schemes";
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";

const client = createPublicClient({
  chain: sepolia,
  transport: http(),
});

// Verify payment
const result = await exact.evm.verify(
  client,
  paymentPayload,
  paymentRequirements
);

if (!result.isValid) {
  console.error("Invalid payment:", result.invalidReason);
}
```

### Settlement

```typescript
import { exact } from "@secured-finance/sf-x402/schemes";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.PRIVATE_KEY);
const walletClient = createWalletClient({
  account,
  chain: sepolia,
  transport: http(),
});

// Settle payment (calls FeeReceiver if configured)
const settleResult = await exact.evm.settle(
  walletClient,
  paymentPayload,
  paymentRequirements
);

if (settleResult.success) {
  console.log("Transaction:", settleResult.transaction);
}
```

## Manual Server Integration

If you're not using one of our server middleware packages, you can implement the x402 protocol manually:

1. **Return 402 responses** with payment requirements
2. **Validate payments** using the facilitator verify function
3. **Settle payments** on-chain
4. **Return transaction hash** in X-PAYMENT-RESPONSE header

For a complete example, see our [advanced server example](../../examples/typescript/servers/advanced).

## Manual Client Integration

For custom client implementations:

1. **Detect 402 response** with `accepts` array
2. **Select payment requirement** (token, network, amount)
3. **Create payment header** using client SDK
4. **Retry request** with X-PAYMENT header

See implementation examples:
- [x402-fetch](../x402-fetch/src/index.ts)
- [x402-axios](../x402-axios/src/index.ts)

## API Reference

### Core Exports

```typescript
import {
  exact,           // EVM payment scheme
  PaymentRequirements,
  PaymentPayload,
  VerifyResponse,
  SettleResponse,
} from "@secured-finance/sf-x402";
```

### Shared Utilities

```typescript
import {
  getNetworkId,
  getAllAssetsForNetwork,
  calculateFee,
} from "@secured-finance/sf-x402/shared";
```

### Types

```typescript
import {
  Network,
  SupportedEVMNetworks,
  SupportedSVMNetworks,
} from "@secured-finance/sf-x402/types";
```

## Repository

GitHub: [Secured-Finance/x402](https://github.com/Secured-Finance/x402)

## License

MIT
