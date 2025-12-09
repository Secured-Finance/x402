import {
  Account,
  Address,
  Chain,
  getAddress,
  Hex,
  parseErc6492Signature,
  Transport,
  verifyTypedData,
  concat,
  toHex,
} from "viem";
import { getNetworkId } from "../../../shared";
import { getVersion, getERC20Balance } from "../../../shared/evm";
import {
  usdcABI as abi,
  authorizationTypes,
  ConnectedClient,
  SignerWallet,
  createConnectedClient,
} from "../../../types/shared/evm";
import {
  PaymentPayload,
  PaymentRequirements,
  SettleResponse,
  VerifyResponse,
  ExactEvmPayload,
} from "../../../types/verify";
import { SCHEME } from "..";
import { X402Config } from "../../../types";
import { SETTLEMENT_ROUTER_ABI } from "../../../types/shared/evm/settlementRouterABI";
import { verifyCommitment } from "./commitment";

/**
 * Verifies a payment payload against the required payment details
 *
 * This function performs several verification steps:
 * - Verifies protocol version compatibility
 * - Validates the permit signature
 * - Confirms USDC contract address is correct for the chain
 * - Checks permit deadline is sufficiently in the future
 * - Verifies client has sufficient USDC balance
 * - Ensures payment amount meets required minimum
 *
 * @param client - The public client used for blockchain interactions
 * @param payload - The signed payment payload containing transfer parameters and signature
 * @param paymentRequirements - The payment requirements that the payload must satisfy
 * @param config - X402Config
 * @returns A ValidPaymentRequest indicating if the payment is valid and any invalidation reason
 */
export async function verify<
  transport extends Transport,
  chain extends Chain,
  account extends Account | undefined,
>(
  client: ConnectedClient<transport, chain, account>,
  payload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
  config?: X402Config,
): Promise<VerifyResponse> {
  /* TODO: work with security team on brainstorming more verification steps
  verification steps:
    - ✅ verify payload version
    - ✅ verify usdc address is correct for the chain
    - ✅ verify permit signature
    - ✅ verify deadline
    - verify nonce is current
    - ✅ verify client has enough funds to cover paymentRequirements.maxAmountRequired
    - ✅ verify value in payload is enough to cover paymentRequirements.maxAmountRequired
    - check min amount is above some threshold we think is reasonable for covering gas
    - verify resource is not already paid for (next version)
    */

  const exactEvmPayload = payload.payload as ExactEvmPayload;
  
  console.log(`[VERIFY] [START]`, {
    timestamp: Date.now(),
    network: payload.network,
    scheme: payload.scheme,
    payer: exactEvmPayload.authorization.from,
    payloadKeys: Object.keys(exactEvmPayload),
    hasSalt: !!exactEvmPayload.salt,
    salt: exactEvmPayload.salt,
    hasPayTo: !!exactEvmPayload.payTo,
    payTo: exactEvmPayload.payTo,
    hasSettlementMode: !!exactEvmPayload.settlementMode,
    settlementMode: exactEvmPayload.settlementMode,
  });
  // ✅ Use custom RPC URL if provided via config
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let clientToUse: any = client;
  try {
    const rpcUrl = config?.evmConfig?.rpcUrls?.[payload.network];
    if (rpcUrl) {
      clientToUse = createConnectedClient(payload.network, rpcUrl);
    }
  } catch (e) {
    console.warn("Falling back to default client (invalid custom RPC)", e);
  }

  // Verify payload version
  if (payload.scheme !== SCHEME || paymentRequirements.scheme !== SCHEME) {
    return {
      isValid: false,
      invalidReason: `unsupported_scheme`,
      payer: exactEvmPayload.authorization.from,
    };
  }

  let name: string;
  let chainId: number;
  let erc20Address: Address;
  let version: string;
  try {
    chainId = getNetworkId(payload.network);
    erc20Address = paymentRequirements.asset as Address;

    // Use the token name from payment requirements (e.g., "JPYC", "USDC", "USDFC")
    if (!paymentRequirements.extra?.name) {
      throw new Error("Token name not found in payment requirements");
    }
    name = paymentRequirements.extra.name;

    version = paymentRequirements.extra?.version ?? (await getVersion(clientToUse));
  } catch (e) {
    console.error("ERROR in verification setup:", e);
    return {
      isValid: false,
      invalidReason: `invalid_network`,
      payer: (payload.payload as ExactEvmPayload).authorization.from,
    };
  }
  // Verify permit signature is recoverable for the owner address
  // Always use TransferWithAuthorization (SettlementRouter mode)
  const primaryType = "TransferWithAuthorization";

  const permitTypedData = {
    types: authorizationTypes,
    primaryType: primaryType as "TransferWithAuthorization",
    domain: {
      name,
      version,
      chainId,
      verifyingContract: erc20Address,
    },
    message: {
      from: exactEvmPayload.authorization.from,
      to: exactEvmPayload.authorization.to,
      value: exactEvmPayload.authorization.value,
      validAfter: exactEvmPayload.authorization.validAfter,
      validBefore: exactEvmPayload.authorization.validBefore,
      nonce: exactEvmPayload.authorization.nonce,
    },
  };

  let isValidSignature;
  try {
    const { signature } = parseErc6492Signature(exactEvmPayload.signature as Hex);
    isValidSignature = await verifyTypedData({
      address: exactEvmPayload.authorization.from as Address,
      ...permitTypedData,
      signature: signature,
    });
  } catch (e) {
    console.error("ERROR verifying typed data:", {
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
      from: exactEvmPayload.authorization.from,
      network: payload.network,
      chainId,
      tokenName: name,
      tokenVersion: version,
      verifyingContract: erc20Address,
      primaryType,
      signature: exactEvmPayload.signature,
      timestamp: new Date().toISOString(),
    });
    return {
      isValid: false,
      invalidReason: "invalid_exact_evm_payload_signature",
      payer: exactEvmPayload.authorization.from,
    };
  }

  if (!isValidSignature) {
    console.error("Signature verification failed:", {
      from: exactEvmPayload.authorization.from,
      network: payload.network,
      chainId,
      tokenName: name,
      tokenVersion: version,
      verifyingContract: erc20Address,
      primaryType,
      timestamp: new Date().toISOString(),
    });
    return {
      isValid: false,
      invalidReason: "invalid_exact_evm_payload_signature",
      payer: exactEvmPayload.authorization.from,
    };
  }

  const authState = await client.readContract({
    address: erc20Address,
    abi,
    functionName: "authorizationState",
    args: [
      exactEvmPayload.authorization.from as Address,
      exactEvmPayload.authorization.nonce as Hex,
    ],
  });

  if (authState === true) {
    return {
      isValid: false,
      invalidReason: "nonce_already_used",
      payer: exactEvmPayload.authorization.from,
    };
  }

  // For SettlementRouter mode, verify 'to' is the SettlementRouter address
  // For legacy mode, verify 'to' is the merchant (payTo) address
  const expectedRecipient = paymentRequirements.extra?.settlementRouter
    ? (paymentRequirements.extra.settlementRouter as Address)
    : paymentRequirements.payTo;

  if (getAddress(exactEvmPayload.authorization.to) !== getAddress(expectedRecipient)) {
    console.error("[VERIFY] Recipient mismatch:", {
      payloadTo: exactEvmPayload.authorization.to,
      expectedRecipient,
      hasSettlementRouter: !!paymentRequirements.extra?.settlementRouter,
      settlementRouter: paymentRequirements.extra?.settlementRouter,
      payTo: paymentRequirements.payTo,
    });
    return {
      isValid: false,
      invalidReason: "invalid_exact_evm_payload_recipient_mismatch",
      payer: exactEvmPayload.authorization.from,
    };
  }

  // Verify deadline is not yet expired
  // Pad 10 seconds to account for network latency and round tripping
  // This ensures payments work even on slower networks/devices
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const validBeforeTimestamp = BigInt(exactEvmPayload.authorization.validBefore);
  const timeRemaining = Number(validBeforeTimestamp) - currentTimestamp;

  if (validBeforeTimestamp < BigInt(currentTimestamp + 10)) {
    console.error("Deadline too close or expired:", {
      payer: exactEvmPayload.authorization.from,
      network: payload.network,
      currentTimestamp,
      validBefore: exactEvmPayload.authorization.validBefore,
      timeRemaining: `${timeRemaining}s`,
      requiredPadding: "10s",
      timestamp: new Date().toISOString(),
    });
    return {
      isValid: false,
      invalidReason: "invalid_exact_evm_payload_authorization_valid_before", //"Deadline on permit isn't far enough in the future",
      payer: exactEvmPayload.authorization.from,
    };
  }
  // Verify deadline is not yet valid
  if (BigInt(exactEvmPayload.authorization.validAfter) > BigInt(Math.floor(Date.now() / 1000))) {
    return {
      isValid: false,
      invalidReason: "invalid_exact_evm_payload_authorization_valid_after", //"Deadline on permit is in the future",
      payer: exactEvmPayload.authorization.from,
    };
  }
  // Verify client has enough funds to cover paymentRequirements.maxAmountRequired
  const balance = await getERC20Balance(
    clientToUse,
    erc20Address,
    exactEvmPayload.authorization.from as Address,
  );
  if (balance < BigInt(paymentRequirements.maxAmountRequired)) {
    const usingCustomRpc = !!config?.evmConfig?.rpcUrls?.[payload.network];
    console.error("Insufficient balance:", {
      payer: exactEvmPayload.authorization.from,
      network: payload.network,
      token: erc20Address,
      tokenName: name,
      balance: balance.toString(),
      required: paymentRequirements.maxAmountRequired,
      rpcType: usingCustomRpc ? "custom" : "default",
      rpcUrl: usingCustomRpc ? "configured" : "viem-default",
      timestamp: new Date().toISOString(),
    });
    return {
      isValid: false,
      invalidReason: "insufficient_funds", //"Client does not have enough funds",
      payer: exactEvmPayload.authorization.from,
    };
  }
  // Verify value in payload is enough to cover paymentRequirements.maxAmountRequired
  if (BigInt(exactEvmPayload.authorization.value) < BigInt(paymentRequirements.maxAmountRequired)) {
    return {
      isValid: false,
      invalidReason: "invalid_exact_evm_payload_authorization_value", //"Value in payload is not enough to cover paymentRequirements.maxAmountRequired",
      payer: exactEvmPayload.authorization.from,
    };
  }

  return {
    isValid: true,
    invalidReason: undefined,
    payer: exactEvmPayload.authorization.from,
  };
}

/**
 * Settles a payment by executing a USDC transferWithAuthorization transaction
 *
 * This function executes the actual USDC transfer using the signed authorization from the user.
 * The facilitator wallet submits the transaction but does not need to hold or transfer any tokens itself.
 *
 * @param wallet - The facilitator wallet that will submit the transaction
 * @param paymentPayload - The signed payment payload containing the transfer parameters and signature
 * @param paymentRequirements - The original payment details that were used to create the payload
 * @param config - X402 config
 * @returns A PaymentExecutionResponse containing the transaction status and hash
 */
export async function settle<transport extends Transport, chain extends Chain>(
  wallet: SignerWallet<chain, transport>,
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
  config?: X402Config,
): Promise<SettleResponse> {
  const payload = paymentPayload.payload as ExactEvmPayload;
  const settleStartTime = Date.now();

  console.log(`[SETTLE] [START]`, {
    timestamp: settleStartTime,
    network: paymentPayload.network,
    payer: payload.authorization.from,
    settlementRouter: paymentRequirements.extra?.settlementRouter,
    transferHook: paymentRequirements.extra?.transferHook,
    payloadSettlementMode: payload.settlementMode,
    hasSettlementMode: !!payload.settlementMode,
    payloadKeys: Object.keys(payload),
    payloadSalt: payload.salt,
    payloadPayTo: payload.payTo,
    payloadHook: payload.hook,
    payloadFacilitatorFee: payload.facilitatorFee,
    payloadHookData: payload.hookData,
    fullPayload: JSON.stringify(payload, null, 2),
  });

  // re-verify to ensure the payment is still valid
  const valid = await verify(wallet, paymentPayload, paymentRequirements, config);

  if (!valid.isValid) {
    return {
      success: false,
      network: paymentPayload.network,
      transaction: "",
      errorReason: valid.invalidReason ?? "invalid_scheme", //`Payment is no longer valid: ${valid.invalidReason}`,
      payer: payload.authorization.from,
    };
  }

  // Returns the original signature (no-op) if the signature is not a 6492 signature
  const { signature } = parseErc6492Signature(payload.signature as Hex);

  // ===== SettlementRouter Mode (ONLY mode - FeeReceiver removed) =====

  // Validate SettlementRouter configuration
  // If paymentRequirements has settlementRouter, we're in SettlementRouter mode
  // settlementMode in payload is optional and may not be present after encoding/decoding
  const hasSettlementRouter = !!paymentRequirements.extra?.settlementRouter;
  const hasTransferHook = !!paymentRequirements.extra?.transferHook;
  
  console.log(`[SETTLE] [VALIDATION]`, {
    timestamp: Date.now(),
    elapsed: Date.now() - settleStartTime,
    hasSettlementRouter,
    hasTransferHook,
    payloadSettlementMode: payload.settlementMode,
    settlementRouter: paymentRequirements.extra?.settlementRouter,
    transferHook: paymentRequirements.extra?.transferHook,
  });

  if (!hasSettlementRouter || !hasTransferHook) {
    console.error(`[SETTLE] [VALIDATION_FAILED]`, {
      timestamp: Date.now(),
      elapsed: Date.now() - settleStartTime,
      reason: "Missing settlementRouter or transferHook in paymentRequirements",
      hasSettlementRouter,
      hasTransferHook,
    });
    
    return {
      success: false,
      network: paymentPayload.network,
      transaction: "",
      errorReason: "settlement_router_not_configured",
      payer: payload.authorization.from,
    };
  }

  // At this point we know extra exists and has the required fields
  const extra = paymentRequirements.extra!;
  const settlementRouter = extra.settlementRouter as Address;
  const transferHook = extra.transferHook as Address;
  const merchant = extra.merchant as Address;
  const facilitatorFee = BigInt(extra.feeAmount as string);
  
  // Get salt from payload, or fallback to paymentRequirements if available
  // Salt is required for commitment verification
  const salt = (payload.salt as Hex) || (extra.salt as Hex);
  const hookData = (payload.hookData as Hex) || (payload.hookData as Hex) || "0x";
  
  // Get payTo from payload or fallback to merchant from paymentRequirements
  const payTo = (payload.payTo as Address) || merchant;
  
  // Get hook from payload or fallback to transferHook from paymentRequirements
  const hook = (payload.hook as Address) || transferHook;
  
  const chainId = getNetworkId(paymentPayload.network);

  console.log(`[SETTLE] [COMMITMENT_PARAMS]`, {
    timestamp: Date.now(),
    elapsed: Date.now() - settleStartTime,
    salt: salt || "MISSING",
    saltFromPayload: !!payload.salt,
    saltFromExtra: !!extra.salt,
    payTo: payTo,
    payToFromPayload: !!payload.payTo,
    hook: hook,
    hookFromPayload: !!payload.hook,
    hookData: hookData,
    facilitatorFee: facilitatorFee.toString(),
    merchant: merchant,
    nonce: payload.authorization.nonce,
  });

  // Salt is required - if missing, we can't verify commitment
  if (!salt) {
    console.error(`[SETTLE] [MISSING_SALT]`, {
      timestamp: Date.now(),
      elapsed: Date.now() - settleStartTime,
      payloadKeys: Object.keys(payload),
      extraKeys: Object.keys(extra),
    });
    
    return {
      success: false,
      network: paymentPayload.network,
      transaction: "",
      errorReason: "invalid_payload", // Salt is required for SettlementRouter commitment verification
      payer: payload.authorization.from,
    };
  }

  // 1. Verify commitment matches nonce
  const isValidCommitment = verifyCommitment(payload.authorization.nonce as Hex, {
    chainId,
    router: settlementRouter,
    token: paymentRequirements.asset as Address,
    from: payload.authorization.from as Address,
    value: BigInt(payload.authorization.value),
    validAfter: BigInt(payload.authorization.validAfter),
    validBefore: BigInt(payload.authorization.validBefore),
    salt,
    payTo,
    facilitatorFee,
    hook,
    hookData,
  });

  console.log(`[SETTLE] [COMMITMENT_VERIFICATION]`, {
    timestamp: Date.now(),
    elapsed: Date.now() - settleStartTime,
    isValidCommitment,
    nonce: payload.authorization.nonce,
  });

  if (!isValidCommitment) {
    return {
      success: false,
      network: paymentPayload.network,
      transaction: "",
      errorReason: "invalid_commitment",
      payer: payload.authorization.from,
    };
  }

  // 2. Check idempotency (prevent duplicate settlement)
  const contextKey = await wallet.readContract({
    address: settlementRouter,
    abi: SETTLEMENT_ROUTER_ABI,
    functionName: "calculateContextKey",
    args: [
      payload.authorization.from as Address,
      paymentRequirements.asset as Address,
      payload.authorization.nonce as Hex,
    ],
  });

  const isSettled = await wallet.readContract({
    address: settlementRouter,
    abi: SETTLEMENT_ROUTER_ABI,
    functionName: "isSettled",
    args: [contextKey],
  });

  if (isSettled) {
    return {
      success: false,
      network: paymentPayload.network,
      transaction: "",
      errorReason: "already_settled",
      payer: payload.authorization.from,
    };
  }

  // 3. Format signature: concat(r, s, v) as bytes
  const sig = signature.slice(2); // Remove 0x prefix
  const r = `0x${sig.slice(0, 64)}` as Hex;
  const s = `0x${sig.slice(64, 128)}` as Hex;
  const v = parseInt(sig.slice(128, 130), 16);
  const formattedSignature = concat([r, s, toHex(v)]);

  // 4. Call settleAndExecute on SettlementRouter
  console.log(`[SETTLE] [TRANSACTION_PREPARE]`, {
    timestamp: Date.now(),
    elapsed: Date.now() - settleStartTime,
    settlementRouter,
    transferHook,
    merchant,
    facilitatorFee: facilitatorFee.toString(),
    value: payload.authorization.value,
  });

  let tx: Hex;
  try {
    tx = await wallet.writeContract({
      address: settlementRouter,
      abi: SETTLEMENT_ROUTER_ABI,
      functionName: "settleAndExecute",
      args: [
        paymentRequirements.asset as Address, // token
        payload.authorization.from as Address, // from
        BigInt(payload.authorization.value), // value
        BigInt(payload.authorization.validAfter), // validAfter
        BigInt(payload.authorization.validBefore), // validBefore
        payload.authorization.nonce as Hex, // nonce (commitment)
        formattedSignature, // signature (as bytes)
        salt, // salt
        merchant, // payTo
        facilitatorFee, // facilitatorFee
        transferHook, // hook
        hookData, // hookData
      ],
      chain: wallet.chain as Chain,
    });
  } catch (txError) {
    console.error(`[SETTLE] [TRANSACTION_ERROR]`, {
      timestamp: Date.now(),
      elapsed: Date.now() - settleStartTime,
      error: txError instanceof Error ? txError.message : String(txError),
      errorName: txError instanceof Error ? txError.name : undefined,
      errorStack: txError instanceof Error ? txError.stack : undefined,
      // Log transaction parameters for debugging
      settlementRouter,
      token: paymentRequirements.asset,
      from: payload.authorization.from,
      value: payload.authorization.value,
      nonce: payload.authorization.nonce,
      salt,
      merchant,
      facilitatorFee: facilitatorFee.toString(),
      transferHook,
    });
    
    return {
      success: false,
      network: paymentPayload.network,
      transaction: "",
      errorReason: "invalid_transaction_state",
      payer: payload.authorization.from,
    };
  }

  console.log(`[SETTLE] [TRANSACTION_SUBMITTED]`, {
    timestamp: Date.now(),
    elapsed: Date.now() - settleStartTime,
    transactionHash: tx,
  });

  const receipt = await wallet.waitForTransactionReceipt({ hash: tx });

  console.log(`[SETTLE] [TRANSACTION_RECEIPT]`, {
    timestamp: Date.now(),
    elapsed: Date.now() - settleStartTime,
    transactionHash: tx,
    status: receipt.status,
    blockNumber: receipt.blockNumber.toString(),
  });

  if (receipt.status !== "success") {
    return {
      success: false,
      errorReason: "invalid_transaction_state", //`Transaction failed`,
      transaction: tx,
      network: paymentPayload.network,
      payer: payload.authorization.from,
    };
  }

  console.log(`[SETTLE] [SUCCESS]`, {
    timestamp: Date.now(),
    totalDuration: Date.now() - settleStartTime,
    transactionHash: tx,
    network: paymentPayload.network,
    payer: payload.authorization.from,
  });

  return {
    success: true,
    transaction: tx,
    network: paymentPayload.network,
    payer: payload.authorization.from,
  };
}
