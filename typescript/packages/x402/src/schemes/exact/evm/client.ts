import { Address, Chain, LocalAccount, Transport, Hex } from "viem";
import { isSignerWallet, SignerWallet } from "../../../types/shared/evm";
import { PaymentPayload, PaymentRequirements, UnsignedPaymentPayload } from "../../../types/verify";
import { createNonce, signAuthorization } from "./sign";
import { encodePayment } from "./utils/paymentUtils";
import { calculateCommitment, generateSalt } from "./commitment";
import { getNetworkId } from "../../../shared";
import { SETTLEMENT_ROUTER_CONSTANTS } from "../../../constants";

/**
 * Prepares an unsigned payment header with the given sender address and payment requirements.
 *
 * Supports two modes:
 * 1. Standard mode: Uses FeeReceiver or direct transfer (random nonce)
 * 2. SettlementRouter mode: Uses audited SettlementRouter + hooks (commitment-based nonce)
 *
 * @param from - The sender's address from which the payment will be made
 * @param x402Version - The version of the X402 protocol to use
 * @param paymentRequirements - The payment requirements containing scheme and network information
 * @returns An unsigned payment payload containing authorization details
 */
export function preparePaymentHeader(
  from: Address,
  x402Version: number,
  paymentRequirements: PaymentRequirements,
): UnsignedPaymentPayload {
  const validAfter = BigInt(
    Math.floor(Date.now() / 1000) - 600, // 10 minutes before
  ).toString();
  const validBefore = BigInt(
    Math.floor(Date.now() / 1000 + paymentRequirements.maxTimeoutSeconds),
  ).toString();

  // ===== SettlementRouter Mode (ONLY mode - FeeReceiver removed) =====

  // Validate SettlementRouter configuration
  console.log(`[CLIENT] [PREPARE_PAYMENT_HEADER]`, {
    hasExtra: !!paymentRequirements.extra,
    hasSettlementRouter: !!paymentRequirements.extra?.settlementRouter,
    hasTransferHook: !!paymentRequirements.extra?.transferHook,
    hasFeeAmount: !!paymentRequirements.extra?.feeAmount,
    settlementRouter: paymentRequirements.extra?.settlementRouter,
    transferHook: paymentRequirements.extra?.transferHook,
    feeAmount: paymentRequirements.extra?.feeAmount,
    extraKeys: paymentRequirements.extra ? Object.keys(paymentRequirements.extra) : [],
  });

  if (!paymentRequirements.extra?.settlementRouter ||
      !paymentRequirements.extra?.transferHook ||
      !paymentRequirements.extra?.feeAmount) {
    console.error(`[CLIENT] [PREPARE_PAYMENT_HEADER] [ERROR]`, {
      error: 'SettlementRouter configuration missing in payment requirements',
      hasSettlementRouter: !!paymentRequirements.extra?.settlementRouter,
      hasTransferHook: !!paymentRequirements.extra?.transferHook,
      hasFeeAmount: !!paymentRequirements.extra?.feeAmount,
    });
    throw new Error('SettlementRouter configuration missing in payment requirements. Ensure settlementRouter and transferHook are deployed.');
  }

  // Generate salt for unique settlement identification
  const salt = generateSalt();

  // Extract settlement parameters from payment requirements
  const settlementRouter = paymentRequirements.extra.settlementRouter as Address;
  const transferHook = paymentRequirements.extra.transferHook as Address;
  const facilitatorFee = BigInt(paymentRequirements.extra.feeAmount as string);
  const merchant = paymentRequirements.extra.merchant as Address;
  const hookData = (paymentRequirements.extra.hookData as Hex) || SETTLEMENT_ROUTER_CONSTANTS.EMPTY_HOOK_DATA;
  const chainId = getNetworkId(paymentRequirements.network);

  // Calculate commitment hash (becomes the nonce)
  const commitment = calculateCommitment({
    chainId,
    router: settlementRouter,
    token: paymentRequirements.asset as Address,
    from,
    value: BigInt(paymentRequirements.maxAmountRequired),
    validAfter: BigInt(validAfter),
    validBefore: BigInt(validBefore),
    salt,
    payTo: merchant,
    facilitatorFee,
    hook: transferHook,
    hookData,
  });

  const unsignedPayload = {
    x402Version,
    scheme: paymentRequirements.scheme,
    network: paymentRequirements.network,
    payload: {
      signature: undefined,
      authorization: {
        from,
        to: settlementRouter, // ← Authorize transfer TO SettlementRouter
        value: paymentRequirements.maxAmountRequired,
        validAfter: validAfter.toString(),
        validBefore: validBefore.toString(),
        nonce: commitment, // ← Commitment hash as nonce (security!)
      },
      // Include settlement parameters for facilitator
      settlementMode: true,
      salt,
      payTo: merchant,
      facilitatorFee: facilitatorFee.toString(),
      hook: transferHook,
      hookData,
    },
  };

  console.log(`[CLIENT] [PREPARE_PAYMENT_HEADER] [SUCCESS]`, {
    to: unsignedPayload.payload.authorization.to,
    settlementRouter,
    hasSalt: !!salt,
    salt: salt,
    hasPayTo: !!unsignedPayload.payload.payTo,
    payTo: unsignedPayload.payload.payTo,
    hasHook: !!unsignedPayload.payload.hook,
    hook: unsignedPayload.payload.hook,
    hasFacilitatorFee: !!unsignedPayload.payload.facilitatorFee,
    facilitatorFee: unsignedPayload.payload.facilitatorFee,
    hasHookData: unsignedPayload.payload.hookData !== undefined,
    hookData: unsignedPayload.payload.hookData,
    hasSettlementMode: !!unsignedPayload.payload.settlementMode,
    settlementMode: unsignedPayload.payload.settlementMode,
    commitment: commitment,
    payloadKeys: Object.keys(unsignedPayload.payload),
  });

  return unsignedPayload;
}

/**
 * Signs a payment header using the provided client and payment requirements.
 *
 * @param client - The signer wallet instance used to sign the payment header
 * @param paymentRequirements - The payment requirements containing scheme and network information
 * @param unsignedPaymentHeader - The unsigned payment payload to be signed
 * @returns A promise that resolves to the signed payment payload
 */
export async function signPaymentHeader<transport extends Transport, chain extends Chain>(
  client: SignerWallet<chain, transport> | LocalAccount,
  paymentRequirements: PaymentRequirements,
  unsignedPaymentHeader: UnsignedPaymentPayload,
): Promise<PaymentPayload> {
  const { signature } = await signAuthorization(
    client,
    unsignedPaymentHeader.payload.authorization,
    paymentRequirements,
  );

  return {
    ...unsignedPaymentHeader,
    payload: {
      ...unsignedPaymentHeader.payload,
      signature,
    },
  };
}

/**
 * Creates a complete payment payload by preparing and signing a payment header.
 *
 * @param client - The signer wallet instance used to create and sign the payment
 * @param x402Version - The version of the X402 protocol to use
 * @param paymentRequirements - The payment requirements containing scheme and network information
 * @returns A promise that resolves to the complete signed payment payload
 */
export async function createPayment<transport extends Transport, chain extends Chain>(
  client: SignerWallet<chain, transport> | LocalAccount,
  x402Version: number,
  paymentRequirements: PaymentRequirements,
): Promise<PaymentPayload> {
  const from = isSignerWallet(client) ? client.account!.address : client.address;
  const unsignedPaymentHeader = preparePaymentHeader(from, x402Version, paymentRequirements);
  return signPaymentHeader(client, paymentRequirements, unsignedPaymentHeader);
}

/**
 * Creates and encodes a payment header for the given client and payment requirements.
 *
 * @param client - The signer wallet instance used to create the payment header
 * @param x402Version - The version of the X402 protocol to use
 * @param paymentRequirements - The payment requirements containing scheme and network information
 * @returns A promise that resolves to the encoded payment header string
 */
export async function createPaymentHeader(
  client: SignerWallet | LocalAccount,
  x402Version: number,
  paymentRequirements: PaymentRequirements,
): Promise<string> {
  const payment = await createPayment(client, x402Version, paymentRequirements);
  return encodePayment(payment);
}
