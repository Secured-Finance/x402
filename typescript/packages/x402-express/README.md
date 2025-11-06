# x402-payments

**Express Middleware for HTTP 402 Payment Required**

Add blockchain payments to your Express API in minutes. Accept USDC, JPYC, and USDFC with automatic payment splitting via FeeReceiver contract.

[![npm version](https://badge.fury.io/js/x402-payments.svg)](https://www.npmjs.com/package/x402-payments)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- ✅ **Drop-in Express middleware** - Add payments with 3 lines of code  
- ✅ **Multi-token support** - USDC, JPYC, USDFC
- ✅ **Multi-network** - Sepolia, Ethereum Mainnet, Filecoin Calibration, Filecoin Mainnet
- ✅ **Gasless for users** - EIP-3009 transfers (no gas fees for payers)
- ✅ **FeeReceiver contract** - Automatic 0.3% platform fee split
- ✅ **Token filtering** - Restrict accepted tokens per endpoint
- ✅ **Transaction tracking** - Full tx hash and explorer URL support
- ✅ **Dynamic pricing** - Calculate prices on-the-fly
- ✅ **TypeScript** - Full type safety

## Installation

\`\`\`bash
npm install x402-payments x402
\`\`\`

## Quick Start

\`\`\`typescript
import express from 'express';
import { paymentMiddleware, Resource } from 'x402-payments';

const app = express();

app.get('/premium-content',
  paymentMiddleware(
    '0xYourWalletAddress',
    {
      'GET /premium-content': {
        price: '$1.00',
        network: 'sepolia'
      }
    },
    {
      url: 'https://x402-0ti6.onrender.com' as Resource
    }
  ),
  (req, res) => {
    res.json({ message: 'This is premium content!' });
  }
);

app.listen(3000);
\`\`\`

## Dynamic Pricing Example

\`\`\`typescript
import { paymentMiddleware, Resource } from 'x402-payments';

const PAY_TO = '0x3D0eAE988A2790EE25316FEdaCC87883438FC303' as \`0x\${string}\`;
const FACILITATOR_URL = 'https://x402-0ti6.onrender.com' as Resource;

app.post('/checkout', (req, res, next) => {
  // Calculate dynamic price
  const items = req.body.items;
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.qty), 0);
  
  // Get network and token from request
  const selectedNetwork = req.body.network || 'filecoin-calibration';
  const selectedToken = req.body.token;
  
  // Store cart info
  (req as any).cartInfo = { subtotal, items };
  
  // Apply middleware with dynamic price
  const middleware = paymentMiddleware(
    PAY_TO,
    {
      'POST /checkout': {
        price: \`$\${subtotal}\`,
        network: selectedNetwork as any,
        ...(selectedToken && { token: selectedToken as any }),
      },
    },
    {
      url: FACILITATOR_URL,
    }
  );
  
  middleware(req, res, next);
}, (req, res) => {
  const cartInfo = (req as any).cartInfo;
  
  // Get transaction hash from response headers
  const txHash = res.getHeader('X-PAYMENT-TX-HASH') as string;
  const explorerUrl = res.getHeader('X-PAYMENT-EXPLORER-URL') as string;
  
  res.json({
    ok: true,
    message: 'Purchase successful!',
    subtotal: cartInfo.subtotal,
    payment: {
      status: 'settled',
      transactionHash: txHash,
      explorerUrl: explorerUrl,
    },
  });
});
\`\`\`

## Supported Networks

| Network | Type | Use Case |
|---------|------|----------|
| \`sepolia\` | Ethereum Testnet | Development and testing |
| \`mainnet\` | Ethereum Mainnet | Production payments |
| \`filecoin-calibration\` | Filecoin Testnet | Development and testing |
| \`filecoin\` | Filecoin Mainnet | Production payments on FEVM |

## Supported Tokens

| Token | Networks | Decimals |
|-------|----------|----------|
| USDC | Sepolia, Mainnet | 6 |
| JPYC | Sepolia, Mainnet | 6 |
| USDFC | Filecoin Calibration, Filecoin | 18 |

