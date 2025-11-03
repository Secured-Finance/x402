# X402 Facilitator Deployment Guide

## What is the Facilitator?

The **facilitator** is a critical piece of the x402 protocol infrastructure. It's a simple Express.js server that:

1. **Verifies** payment authorizations are valid (signatures, nonces, expiration)
2. **Settles** payments by executing on-chain transactions
3. **Advertises** which networks and payment schemes it supports

**Merchant servers** (running x402-express middleware) call your facilitator to process payments.

---

## What You Need to Deploy

### Essential Packages

Your facilitator only needs **2 things**:

```
examples/typescript/facilitator/    ← The facilitator server (this directory)
typescript/packages/x402/           ← Core x402 library
```

That's it! Everything else in the monorepo is examples, documentation, or client libraries.

### Dependencies

The facilitator has minimal dependencies:

```json
{
  "dependencies": {
    "dotenv": "^16.4.7",      // Environment variable management
    "express": "^4.18.2",     // Web server
    "x402": "workspace:*"      // Core protocol library
  }
}
```

The `x402` package itself includes:
- `viem` - EVM blockchain interactions
- `@solana/kit` - Solana blockchain interactions
- `zod` - Request validation

---

## Deployment Options

### Option 1: Deploy Just the Facilitator (Recommended)

Extract only what you need:

```bash
# Create a new directory for your facilitator
mkdir my-x402-facilitator
cd my-x402-facilitator

# Copy the facilitator code
cp -r /path/to/x402/examples/typescript/facilitator/* .

# The x402 package dependency will be installed from npm
npm install
```

### Option 2: Deploy from Monorepo

Keep the full monorepo structure:

```bash
# Clone the repository
git clone https://github.com/yourusername/x402-faci.git
cd x402-faci

# Install dependencies (uses pnpm workspaces)
pnpm install

# Run the facilitator
cd examples/typescript/facilitator
pnpm dev
```

---

## Configuration

### 1. Create `.env` file

```bash
cp .env.example .env
```

### 2. Set Private Keys

You need at least ONE private key:

**For EVM networks** (Ethereum, Base, Polygon, etc.):
```env
EVM_PRIVATE_KEY=0x...your-private-key
```

**For Solana**:
```env
SVM_PRIVATE_KEY=base58-encoded-key
SVM_RPC_URL=https://your-rpc-url.com  # Optional, uses default if not set
```

### 3. Verify Configuration

The facilitator will automatically support networks based on which keys are provided:

| Key Set | Networks Supported |
|---------|-------------------|
| `EVM_PRIVATE_KEY` only | Sepolia, Base Sepolia, Ethereum, Base, Polygon, Avalanche |
| `SVM_PRIVATE_KEY` only | Solana devnet, Solana mainnet |
| Both keys | All of the above |

---

## Running the Facilitator

### Development

```bash
npm run dev
# or
pnpm dev
```

The server starts on `http://localhost:3000` (or `PORT` from `.env`)

### Production

```bash
# Build if needed (facilitator uses tsx, no build step required)
NODE_ENV=production npm start
```

---

## Endpoints

Once running, your facilitator exposes:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check - returns server status |
| `/supported` | GET | Lists supported networks/schemes |
| `/verify` | POST | Verifies a payment authorization |
| `/settle` | POST | Executes on-chain settlement |

### Example: Check Health

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "networks": {
    "evm": true,
    "svm": true
  }
}
```

### Example: Get Supported Networks

```bash
curl http://localhost:3000/supported
```

Response:
```json
{
  "kinds": [
    {
      "x402Version": 1,
      "scheme": "exact",
      "network": "sepolia"
    },
    {
      "x402Version": 1,
      "scheme": "exact",
      "network": "base"
    }
    // ... more networks
  ]
}
```

---

## Network Support

### Current Token Support

| Token | Networks | Status |
|-------|----------|--------|
| **USDC** | Ethereum, Base, Polygon, Avalanche, Sepolia, Base Sepolia, and 6 more | ✅ Fully Supported |
| **JPYC** | TBD | 🚧 Coming Soon |

USDC addresses are pre-configured in `typescript/packages/x402/src/types/shared/evm/config.ts`

### FeeReceiver Contract

The `FeeReceiver.sol` contract automatically splits payments:
- **0.3% fee** (min 0.01 tokens) → Facilitator treasury
- **Remainder** → Merchant

**Currently deployed:**
- Sepolia: `0x0d06F661a4fCB8CF357dCc40b0938eD1f6aC7172`

**To deploy on other networks:**
```bash
# You'll need to deploy the contract and update config.ts
# See /FeeReceiver.sol
```

---

## Production Deployment Checklist

### Security

- [ ] **Private Keys**: Move to HSM/KMS (AWS KMS, Google Secret Manager, etc.)
- [ ] **Authentication**: Add API key authentication to `/verify` and `/settle`
- [ ] **Rate Limiting**: Prevent abuse (use `express-rate-limit`)
- [ ] **CORS**: Configure allowed origins
- [ ] **HTTPS**: Use TLS/SSL certificates
- [ ] **Environment**: Set `NODE_ENV=production`

### Infrastructure

- [ ] **RPC Providers**: Use dedicated providers (Alchemy, QuickNode, Helius)
- [ ] **Load Balancing**: Distribute traffic across multiple instances
- [ ] **Auto-scaling**: Scale based on request volume
- [ ] **Health Checks**: Configure with your orchestrator (K8s, ECS, etc.)

### Monitoring

- [ ] **Logging**: Structured logs to CloudWatch/Datadog/Splunk
- [ ] **Metrics**: Track request rates, errors, settlement times
- [ ] **Alerting**: Alert on errors, high gas costs, low wallet balances
- [ ] **Wallet Monitoring**: Monitor gas token balances

### Operations

- [ ] **Documentation**: Document runbooks for common issues
- [ ] **Wallet Funding**: Set up alerts when gas funds run low
- [ ] **Backup**: Have backup private keys securely stored
- [ ] **Testing**: Thoroughly test on testnets first

---

## Cost Considerations

### Gas Fees

The facilitator pays gas fees for every settlement:

| Network | Typical Gas Cost (USD) | Notes |
|---------|------------------------|-------|
| Ethereum | $5-50 | High gas, use for large payments |
| Base | $0.01-0.10 | Very cheap L2 |
| Polygon | $0.01-0.05 | Low cost |
| Avalanche | $0.10-0.50 | Moderate |
| Solana | $0.0001-0.001 | Extremely cheap |

**Facilitator fee (0.3%, min $0.01) should cover gas costs on L2s and Solana.**

### Recommended: Start with Base or Polygon

- Low gas costs make facilitator fee viable
- High throughput for many transactions
- EVM compatible (familiar tooling)

---

## Scaling Considerations

### Horizontal Scaling

The facilitator is **stateless** - you can run multiple instances:

```
                    ┌─→ Facilitator Instance 1
Load Balancer  ────┼─→ Facilitator Instance 2
                    └─→ Facilitator Instance 3
```

### Database (Optional)

Current implementation is stateless. For production, consider adding:

- **Transaction logging**: Record all verify/settle requests
- **Nonce tracking**: Prevent replay attacks more reliably
- **Analytics**: Track payment volumes, success rates, etc.

### Caching (Optional)

Consider caching:
- Network configurations
- Token contract ABIs
- RPC responses (with short TTL)

---

## Troubleshooting

### "Missing required environment variables"

**Cause**: Neither `EVM_PRIVATE_KEY` nor `SVM_PRIVATE_KEY` is set

**Fix**: Set at least one private key in `.env`

### "EVM payments not supported (no private key configured)"

**Cause**: Merchant requested EVM payment but `EVM_PRIVATE_KEY` not set

**Fix**: Add `EVM_PRIVATE_KEY` to `.env` or ask merchant to use Solana

### "Invalid network: X"

**Cause**: Merchant requested unsupported network

**Fix**: Add network to `/supported` endpoint or ask merchant to use a supported network

### Settlement fails: "Insufficient funds"

**Cause**: Facilitator wallet doesn't have enough gas tokens

**Fix**: Fund the wallet with ETH/MATIC/AVAX/SOL

### High gas costs

**Cause**: Using expensive networks (Ethereum mainnet) or during high congestion

**Fix**:
- Use L2s (Base, Polygon) for lower costs
- Implement gas price monitoring
- Batch settlements if possible

---

## Architecture

```
┌─────────────┐
│   Client    │ (User's wallet)
└──────┬──────┘
       │ 1. Creates payment authorization (off-chain)
       ▼
┌─────────────────────┐
│  Merchant Server    │ (Running x402-express)
│  (e.g., ecom API)   │
└──────┬──────────────┘
       │ 2. Calls facilitator /verify
       │ 3. Calls facilitator /settle
       ▼
┌─────────────────────┐
│   FACILITATOR       │ ◄── YOU DEPLOY THIS
│  (This Server)      │
└──────┬──────────────┘
       │ 4. Submits transaction
       ▼
┌─────────────────────┐
│    Blockchain       │ (Ethereum, Base, Solana, etc.)
│  (USDC Contract)    │
└─────────────────────┘
```

**Key Point**: The facilitator is infrastructure, not a merchant tool. Merchants call YOUR facilitator.

---

## Next Steps

1. **Test on Testnet**
   ```bash
   # Use Sepolia testnet
   EVM_PRIVATE_KEY=0x...testnet-key
   npm run dev
   ```

2. **Deploy FeeReceiver Contract**
   - Deploy to your target mainnets
   - Update `config.ts` with addresses

3. **Set Up Monitoring**
   - Add logging
   - Configure alerts
   - Monitor wallet balances

4. **Go Live**
   - Switch to mainnet keys
   - Update `NODE_ENV=production`
   - Point merchant servers to your facilitator URL

---

## Support & Resources

- **Protocol Docs**: https://x402.org
- **GitHub Issues**: https://github.com/anthropics/x402/issues
- **Discord**: [Join the community]

---

## Summary: What to Deploy

✅ **Deploy This**:
- `examples/typescript/facilitator/` (this directory)
- With `x402` npm package installed

❌ **Don't Deploy**:
- Examples (servers/clients)
- Documentation site
- Test files
- Other language implementations

**Total Size**: ~50MB (mostly node_modules)

**Runtime Requirements**:
- Node.js 18+
- 256MB RAM minimum
- Persistent internet connection
- Private key(s) with gas funds
