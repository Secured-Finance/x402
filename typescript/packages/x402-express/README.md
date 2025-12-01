# @secured-finance/sf-x402-express

**Express Middleware for HTTP 402 Payment Required**

Add blockchain payments to your Express API in minutes. Accept USDC, JPYC, and USDFC with automatic payment splitting via FeeReceiver contract.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- ✅ **Drop-in Express middleware** - Add payments with 3 lines of code
- ✅ **Multi-token support** - USDC, JPYC (18 decimals), USDFC
- ✅ **Multi-network** - Sepolia, Ethereum, Base, Polygon, Avalanche, Filecoin
- ✅ **Gasless for users** - EIP-3009 transfers (no gas fees for payers)
- ✅ **FeeReceiver contract** - Automatic 0.3% platform fee split (min $0.01)
- ✅ **Token filtering** - Restrict accepted tokens per endpoint
- ✅ **Transaction tracking** - Full tx hash and explorer URL support
- ✅ **Dynamic pricing** - Calculate prices on-the-fly
- ✅ **TypeScript** - Full type safety

## Installation

```bash
npm install @secured-finance/sf-x402-express @secured-finance/sf-x402
```

**For GitHub Packages**, add to your `.npmrc`:
```
@secured-finance:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

## Quick Start

### Basic Example - Single Token

```typescript
import express from 'express';
import { paymentMiddleware } from '@secured-finance/sf-x402-express';

const app = express();

app.get('/premium-content',
  paymentMiddleware(
    '0xYourWalletAddress', // Your merchant address
    {
      'GET /premium-content': {
        price: '$1.00',           // Price in USD
        network: 'sepolia'         // Network to use
      }
    },
    {
      url: 'https://facilitator.example.com' // Facilitator service
    }
  ),
  (req, res) => {
    res.json({ message: 'This is premium content!' });
  }
);

app.listen(3000);
```

### Advanced Example - Multi-Token with JPYC

```typescript
import express from 'express';
import { paymentMiddleware } from '@secured-finance/sf-x402-express';

const app = express();
const PAY_TO = '0x3D0eAE988A2790EE25316FEdaCC87883438FC303';
const FACILITATOR_URL = 'https://x402-facilitator.onrender.com';

app.post('/api/subscribe',
  paymentMiddleware(
    PAY_TO,
    {
      'POST /api/subscribe': {
        price: '$9.99',            // Monthly subscription
        network: 'sepolia',
        token: 'JPYC'              // Accept only JPYC
      }
    },
    { url: FACILITATOR_URL }
  ),
  (req, res) => {
    const txHash = res.getHeader('X-PAYMENT-TX-HASH');
    const explorer = res.getHeader('X-PAYMENT-TX-EXPLORER');

    res.json({
      success: true,
      subscription: 'premium',
      payment: {
        transactionHash: txHash,
        explorerUrl: explorer,
      }
    });
  }
);
```

### Dynamic Pricing - Shopping Cart Example

```typescript
import express from 'express';
import { paymentMiddleware } from '@secured-finance/sf-x402-express';

const app = express();
app.use(express.json());

const PRODUCTS = [
  { id: 'p1', name: 'Alpha T-shirt', priceUSD: 0.50 },
  { id: 'p2', name: 'Beta T-shirt', priceUSD: 0.50 },
];

app.post('/checkout',
  (req, res, next) => {
    // Calculate dynamic price based on cart
    let items = req.body.items;
    const selectedNetwork = req.body.network || 'sepolia';
    const selectedToken = req.body.token; // Optional: "USDC" or "JPYC"

    if (typeof items === 'string') {
      items = JSON.parse(items);
    }

    // Compute totals
    let subtotal = 0;
    const lineItems = items.map((it) => {
      const prod = PRODUCTS.find(p => p.id === it.id);
      const qty = Math.max(0, Number(it.qty) || 0);
      const lineTotal = prod ? prod.priceUSD * qty : 0;
      subtotal += lineTotal;
      return {
        id: it.id,
        name: prod?.name ?? 'UNKNOWN',
        unitPriceUSD: prod?.priceUSD ?? 0,
        qty,
        lineTotalUSD: Number(lineTotal.toFixed(6)),
      };
    });

    subtotal = Number(subtotal.toFixed(2));

    if (subtotal === 0) {
      return res.json({
        ok: true,
        subtotal,
        message: 'No payment required for $0.00',
      });
    }

    // Store cart info for after payment
    (req as any).cartInfo = { subtotal, lineItems };

    // Apply x402 middleware with dynamic price and token selection
    const middleware = paymentMiddleware(
      '0xYourWalletAddress',
      {
        'POST /checkout': {
          price: `${subtotal}`,                    // Dynamic price
          network: selectedNetwork as any,
          ...(selectedToken && { token: selectedToken as any }), // Optional token filter
        },
      },
      {
        url: 'https://facilitator.example.com',
      }
    );

    middleware(req, res, next);
  },
  (req, res) => {
    // This runs after payment is verified and settled
    const cartInfo = (req as any).cartInfo;
    const txHash = res.getHeader('X-PAYMENT-TX-HASH');

    res.json({
      ok: true,
      message: 'Purchase successful!',
      subtotal: cartInfo.subtotal,
      lineItems: cartInfo.lineItems,
      payment: {
        status: 'settled',
        transactionHash: txHash,
        timestamp: new Date().toISOString(),
      },
    });
  }
);

app.listen(3000);
```

## Configuration Options

### `paymentMiddleware(payTo, routes, facilitator?, paywall?)`

#### Parameters

**`payTo`** (required): `Address`
- Your merchant wallet address that receives payments
- Can be EVM address (`0x...`) or Solana address

**`routes`** (required): `RoutesConfig`
- Configuration for protected endpoints
- Each route can specify:
  - `price`: USD amount (e.g., `"$1.50"`, `1.5`, `0.001`) or atomic units with asset
  - `network`: Target blockchain network
  - `token?`: Optional token filter (`"USDC"`, `"JPYC"`, or `"USDFC"`)
  - `config?`: Additional options (description, timeout, etc.)

**`facilitator`** (optional): `FacilitatorConfig`
- `url`: Facilitator service endpoint (default: `https://x402.org/facilitator`)
- `createAuthHeaders?`: Function to generate auth headers for facilitator

**`paywall`** (optional): `PaywallConfig`
- `cdpClientKey?`: Coinbase Developer Platform API key
- `appName?`: App name for wallet connection modal
- `appLogo?`: App logo URL
- `sessionTokenEndpoint?`: Endpoint for Onramp session tokens

## Supported Networks

| Network | Chain ID | Type | Tokens |
|---------|----------|------|--------|
| `sepolia` | 11155111 | Testnet | USDC, JPYC |
| `mainnet` | 1 | Mainnet | USDC, JPYC |
| `base` | 8453 | Mainnet | USDC |
| `base-sepolia` | 84532 | Testnet | USDC |
| `polygon` | 137 | Mainnet | USDC, JPYC |
| `polygon-amoy` | 80002 | Testnet | USDC, JPYC |
| `avalanche` | 43114 | Mainnet | USDC, JPYC |
| `avalanche-fuji` | 43113 | Testnet | USDC, JPYC |
| `filecoin` | 314 | Mainnet | USDFC |
| `filecoin-calibration` | 314159 | Testnet | USDFC |

## Supported Tokens

| Token | Symbol | Decimals | Networks |
|-------|--------|----------|----------|
| USD Coin | USDC | 6 | All EVM networks |
| JPY Coin | JPYC | 18 | Ethereum, Polygon, Avalanche, Sepolia |
| USD for Filecoin Community | USDFC | 18 | Filecoin, Filecoin Calibration |

### JPYC Integration

JPYC uses **18 decimals** (not 6 like USDC). The middleware automatically handles this:

```typescript
paymentMiddleware(
  merchantAddress,
  {
    'POST /buy-with-jpyc': {
      price: '$10.00',      // Automatically converts to 10000000000000000000 (18 decimals)
      network: 'sepolia',
      token: 'JPYC'         // Only accepts JPYC
    }
  },
  { url: facilitatorUrl }
)
```

## FeeReceiver Contract

On Sepolia and Filecoin Calibration, payments automatically go through a FeeReceiver contract that splits:
- **0.3% to platform** (minimum $0.01 equivalent)
- **99.7% to merchant**

**Sepolia FeeReceiver**: `0x0d06F661a4fCB8CF357dCc40b0938eD1f6aC7172`
**Filecoin Calibration FeeReceiver**: `0x34a6A7D8d7f8C9F2369b7404904DA943C519Ab13`

This happens automatically when the middleware detects a FeeReceiver deployment on the network.

## Response Headers

After successful payment settlement, these headers are added to the response:

- `X-PAYMENT-RESPONSE`: Settlement result (success/failure)
- `X-PAYMENT-TX-HASH`: Transaction hash on-chain
- `X-PAYMENT-TX-EXPLORER`: Block explorer URL for the transaction

Access them in your route handler:
```typescript
const txHash = res.getHeader('X-PAYMENT-TX-HASH');
const explorerUrl = res.getHeader('X-PAYMENT-TX-EXPLORER');
```

## Error Handling

The middleware returns 402 status codes with detailed error information:

```json
{
  "x402Version": 1,
  "error": "nonce_already_used",
  "accepts": [/* payment requirements */],
  "payer": "0x..."
}
```

Common error reasons:
- `nonce_already_used`: Payment signature was already used
- `invalid_signature`: Signature verification failed
- `insufficient_balance`: Payer doesn't have enough tokens
- `invalid_network`: Network mismatch

## TypeScript Support

Full TypeScript support with exported types:

```typescript
import type {
  PaymentMiddlewareConfig,
  RouteConfig,
  RoutesConfig,
  Network,
  Resource,
} from '@secured-finance/sf-x402-express';
```

## Example Projects

- [E-commerce Demo](../../examples/typescript/servers/express/ecom.ts) - Shopping cart with JPYC support
- [Basic Server](../../examples/typescript/servers/express/index.ts) - Simple protected endpoints

## Core Package

This middleware is built on top of [@secured-finance/sf-x402](../x402), the core x402 protocol implementation.

## Repository

GitHub: [Secured-Finance/x402](https://github.com/Secured-Finance/x402)

## License

MIT
