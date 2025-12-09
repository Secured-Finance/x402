import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Address, getAddress } from "viem";
import type { Address as SolanaAddress } from "@solana/kit";
import { exact } from "@secured-finance/sf-x402/schemes";
import {
  computeRoutePatterns,
  findMatchingPaymentRequirements,
  findMatchingRoute,
  getAllAssetsForNetwork,
  toJsonSafe,
  getNetworkId,
  getUsdcChainConfigForChain,
} from "@secured-finance/sf-x402/shared";
import { calculateFee } from "@secured-finance/sf-x402";
import { getPaywallHtml } from "@secured-finance/sf-x402/paywall";
import type { Network } from "@secured-finance/sf-x402/types";
import { isTestnetNetwork } from "@secured-finance/sf-x402/types";
import {
  FacilitatorConfig,
  moneySchema,
  PaymentPayload,
  PaymentRequirements,
  Resource,
  RoutesConfig,
  PaywallConfig,
  ERC20TokenAmount,
  SupportedEVMNetworks,
  SupportedSVMNetworks,
} from "@secured-finance/sf-x402/types";
import { useFacilitator } from "@secured-finance/sf-x402/verify";
import { safeBase64Encode } from "@secured-finance/sf-x402/shared";
import { usdToAtomic } from "@secured-finance/sf-x402";

import { POST } from "./api/session-token";

/**
 * Creates a payment middleware factory for Next.js
 *
 * @param payTo - The address to receive payments
 * @param routes - Configuration for protected routes and their payment requirements
 * @param facilitator - Optional configuration for the payment facilitator service
 * @param paywall - Optional configuration for the default paywall
 * @returns A Next.js middleware handler
 *
 * @example
 * ```typescript
 * // Simple configuration - All endpoints are protected by $0.01 of USDC on sepolia
 * export const middleware = paymentMiddleware(
 *   '0x123...', // payTo address
 *   {
 *     price: '$0.01', // USDC amount in dollars
 *     network: 'sepolia'
 *   },
 *   // Optional facilitator configuration. Defaults to x402.org/facilitator for testnet usage
 * );
 *
 * // Advanced configuration - Endpoint-specific payment requirements & custom facilitator
 * export const middleware = paymentMiddleware(
 *   '0x123...', // payTo: The address to receive payments
 *   {
 *     '/protected/*': {
 *       price: '$0.001', // USDC amount in dollars
 *       network: 'base',
 *       config: {
 *         description: 'Access to protected content'
 *       }
 *     },
 *     '/api/premium/*': {
 *       price: {
 *         amount: '100000',
 *         asset: {
 *           address: '0xabc',
 *           decimals: 18,
 *           eip712: {
 *             name: 'WETH',
 *             version: '1'
 *           }
 *         }
 *       },
 *       network: 'base'
 *     }
 *   },
 *   {
 *     url: 'https://facilitator.example.com',
 *     createAuthHeaders: async () => ({
 *       verify: { "Authorization": "Bearer token" },
 *       settle: { "Authorization": "Bearer token" }
 *     })
 *   },
 *   {
 *     cdpClientKey: 'your-cdp-client-key',
 *     appLogo: '/images/logo.svg',
 *     appName: 'My App',
 *   }
 * );
 * ```
 */
export function paymentMiddleware(
  payTo: Address | SolanaAddress,
  routes: RoutesConfig,
  facilitator?: FacilitatorConfig,
  paywall?: PaywallConfig,
) {
  const { verify, settle, supported } = useFacilitator(facilitator);
  const x402Version = 1;

  // Pre-compile route patterns to regex and extract verbs
  const routePatterns = computeRoutePatterns(routes);

  return async function middleware(request: NextRequest) {
    const pathname = request.nextUrl.pathname;
    const method = request.method.toUpperCase();

    // Find matching route configuration
    const matchingRoute = findMatchingRoute(routePatterns, pathname, method);

    if (!matchingRoute) {
      return NextResponse.next();
    }

    const { price, network, token, config = {} } = matchingRoute.config;
    const {
      description,
      mimeType,
      maxTimeoutSeconds,
      inputSchema,
      outputSchema,
      customPaywallHtml,
      resource,
      errorMessages,
      discoverable,
    } = config;

    const resourceUrl =
      resource || (`${request.nextUrl.protocol}//${request.nextUrl.host}${pathname}` as Resource);

    let paymentRequirements: PaymentRequirements[] = [];

    // evm networks
    if (SupportedEVMNetworks.includes(network)) {
      // Get chain config to check for FeeReceiver support
      const chainId = getNetworkId(network);
      const chainConfig = getUsdcChainConfigForChain(chainId);

      // Get all available tokens for this network, filtered by token if specified
      const allAssets = getAllAssetsForNetwork(network, token);

      // Create a payment requirement for EACH available token
      for (const asset of allAssets) {
        // Parse the price for this specific asset
        let maxAmountRequired: string;
        if (typeof price === "string" || typeof price === "number") {
          // Price is in USD, convert to atomic units for this asset
          const parsedAmount = moneySchema.safeParse(price);
          if (!parsedAmount.success) {
            return new NextResponse(
              `Invalid price (price: ${price}). Must be in the form "$3.10", 0.10, "0.001"`,
              { status: 500 },
            );
          }
          const parsedUsdAmount = parsedAmount.data;
          maxAmountRequired = usdToAtomic(parsedUsdAmount, asset.decimals);
        } else {
          // Price is already in atomic units with specific asset
          maxAmountRequired = price.amount;
        }

        // Calculate facilitator fee using shared constants
        const totalAmount = BigInt(maxAmountRequired);
        const { feeAmount, merchantAmount } = calculateFee(totalAmount, asset.decimals);

        const paymentReq: PaymentRequirements = {
          scheme: "exact",
          network,
          maxAmountRequired: totalAmount.toString(),
          resource: resourceUrl,
          description: description ?? "",
          mimeType: mimeType ?? "application/json",
          // When using SettlementRouter, payTo should be the router address (what the authorization is signed for)
          // Otherwise, payTo is the merchant address (direct transfer)
          payTo: chainConfig?.settlementRouter 
            ? getAddress(chainConfig.settlementRouter)
            : payTo,
          maxTimeoutSeconds: maxTimeoutSeconds ?? 300,
          asset: getAddress(asset.address),
          outputSchema: {
            input: {
              type: "http",
              method,
              discoverable: discoverable ?? true,
              ...inputSchema,
            },
            output: outputSchema,
          },
          extra: {
            ...(asset as ERC20TokenAmount["asset"]).eip712,
            // Store merchant info and fee for settlement
            merchant: getAddress(payTo as Address),
            merchantAmount: merchantAmount.toString(),
            feeAmount: feeAmount.toString(),
            decimals: asset.decimals, // Include decimals for paywall to use
            // Only include SettlementRouter fields if they exist in chainConfig
            ...(chainConfig?.settlementRouter && {
              settlementRouter: getAddress(chainConfig.settlementRouter),
            }),
            ...(chainConfig?.transferHook && {
              transferHook: getAddress(chainConfig.transferHook),
            }),
            hookData: "0x", // Empty for TransferHook (simple transfers)
          },
        };

        console.log(`[MIDDLEWARE] [PAYMENT_REQUIREMENT_CREATED]`, {
          network,
          token: asset.symbol,
          asset: paymentReq.asset,
          maxAmountRequired: paymentReq.maxAmountRequired,
          merchantAmount: paymentReq.extra?.merchantAmount,
          feeAmount: paymentReq.extra?.feeAmount,
          hasSettlementRouter: !!paymentReq.extra?.settlementRouter,
          hasTransferHook: !!paymentReq.extra?.transferHook,
          settlementRouter: paymentReq.extra?.settlementRouter,
          transferHook: paymentReq.extra?.transferHook,
        });

        paymentRequirements.push(paymentReq);
      }
    }
    // svm networks
    else if (SupportedSVMNetworks.includes(network)) {
      // network call to get the supported payments from the facilitator
      const paymentKinds = await supported();

      // find the payment kind that matches the network and scheme
      let feePayer: string | undefined;
      for (const kind of paymentKinds.kinds) {
        if (kind.network === network && kind.scheme === "exact") {
          feePayer = kind?.extra?.feePayer;
          break;
        }
      }

      // svm networks require a fee payer
      if (!feePayer) {
        throw new Error(`The facilitator did not provide a fee payer for network: ${network}.`);
      }

      // Get all available tokens for Solana, filtered by token if specified
      const allAssets = getAllAssetsForNetwork(network, token);

      // Create a payment requirement for EACH available token
      for (const asset of allAssets) {
        // Parse the price for this specific asset
        let maxAmountRequired: string;
        if (typeof price === "string" || typeof price === "number") {
          // Price is in USD, convert to atomic units for this asset
          const parsedAmount = moneySchema.safeParse(price);
          if (!parsedAmount.success) {
            return new NextResponse(
              `Invalid price (price: ${price}). Must be in the form "$3.10", 0.10, "0.001"`,
              { status: 500 },
            );
          }
          const parsedUsdAmount = parsedAmount.data;
          maxAmountRequired = usdToAtomic(parsedUsdAmount, asset.decimals);
        } else {
          // Price is already in atomic units with specific asset
          maxAmountRequired = price.amount;
        }

        // build the payment requirements for svm
        paymentRequirements.push({
          scheme: "exact",
          network,
          maxAmountRequired,
          resource: resourceUrl,
          description: description ?? "",
          mimeType: mimeType ?? "",
          payTo: payTo,
          maxTimeoutSeconds: maxTimeoutSeconds ?? 60,
          asset: asset.address,
          // TODO: Rename outputSchema to requestStructure
          outputSchema: {
            input: {
              type: "http",
              method,
              discoverable: discoverable ?? true,
              ...inputSchema,
            },
            output: outputSchema,
          },
          extra: {
            feePayer,
          },
        });
      }
    } else {
      throw new Error(`Unsupported network: ${network}`);
    }

    // Check for payment header
    const paymentHeader = request.headers.get("X-PAYMENT");
    const requestId = crypto.randomUUID();
    const middlewareStartTime = Date.now();

    console.log(`[MIDDLEWARE] [${requestId}] [START]`, {
      timestamp: middlewareStartTime,
      pathname,
      method,
      network,
      token,
      paymentRequirementsCount: paymentRequirements.length,
      hasPaymentHeader: !!paymentHeader,
    });

    if (!paymentHeader) {
      const accept = request.headers.get("Accept");
      if (accept?.includes("text/html")) {
        const userAgent = request.headers.get("User-Agent");
        if (userAgent?.includes("Mozilla")) {
          let displayAmount: number;
          if (typeof price === "string" || typeof price === "number") {
            const parsed = moneySchema.safeParse(price);
            if (parsed.success) {
              displayAmount = parsed.data;
            } else {
              displayAmount = Number.NaN;
            }
          } else {
            displayAmount = Number(price.amount) / 10 ** price.asset.decimals;
          }

          // TODO: handle paywall html for solana
          const html =
            customPaywallHtml ??
            getPaywallHtml({
              amount: displayAmount,
              paymentRequirements: toJsonSafe(paymentRequirements) as Parameters<
                typeof getPaywallHtml
              >[0]["paymentRequirements"],
              currentUrl: request.url,
              testnet: isTestnetNetwork(network as Network),
              cdpClientKey: paywall?.cdpClientKey,
              appLogo: paywall?.appLogo,
              appName: paywall?.appName,
              sessionTokenEndpoint: paywall?.sessionTokenEndpoint,
              rpcUrls: paywall?.rpcUrls,
            });
          return new NextResponse(html, {
            status: 402,
            headers: { 
              "Content-Type": "text/html",
              // Prevent browsers from caching the paywall HTML (which contains embedded SDK code)
              "Cache-Control": "no-cache, no-store, must-revalidate",
              "Pragma": "no-cache",
              "Expires": "0",
            },
          });
        }
      }

      return new NextResponse(
        JSON.stringify({
          x402Version,
          error: errorMessages?.paymentRequired || "X-PAYMENT header is required",
          accepts: paymentRequirements,
        }),
        { status: 402, headers: { "Content-Type": "application/json" } },
      );
    }

    // Verify payment
    let decodedPayment: PaymentPayload;
    try {
      console.log(`[MIDDLEWARE] [${requestId}] [DECODE_PAYMENT]`, {
        timestamp: Date.now(),
        elapsed: Date.now() - middlewareStartTime,
        paymentHeaderLength: paymentHeader.length,
      });

      decodedPayment = exact.evm.decodePayment(paymentHeader);
      decodedPayment.x402Version = x402Version;

      console.log(`[MIDDLEWARE] [${requestId}] [PAYMENT_DECODED]`, {
        timestamp: Date.now(),
        elapsed: Date.now() - middlewareStartTime,
        network: decodedPayment.network,
        scheme: decodedPayment.scheme,
        payer:
          "authorization" in decodedPayment.payload
            ? decodedPayment.payload.authorization.from
            : "N/A",
        payloadKeys: Object.keys(decodedPayment.payload),
        hasSalt: !!(decodedPayment.payload as any).salt,
        salt: (decodedPayment.payload as any).salt,
        hasPayTo: !!(decodedPayment.payload as any).payTo,
        payTo: (decodedPayment.payload as any).payTo,
        hasSettlementMode: !!(decodedPayment.payload as any).settlementMode,
        settlementMode: (decodedPayment.payload as any).settlementMode,
      });
    } catch (error) {
      return new NextResponse(
        JSON.stringify({
          x402Version,
          error:
            errorMessages?.invalidPayment || (error instanceof Error ? error : "Invalid payment"),
          accepts: paymentRequirements,
        }),
        { status: 402, headers: { "Content-Type": "application/json" } },
      );
    }

    const selectedPaymentRequirements = findMatchingPaymentRequirements(
      paymentRequirements,
      decodedPayment,
    );

    console.log(`[MIDDLEWARE] [${requestId}] [MATCHING_REQUIREMENTS]`, {
      timestamp: Date.now(),
      elapsed: Date.now() - middlewareStartTime,
      found: !!selectedPaymentRequirements,
      asset: selectedPaymentRequirements?.asset,
      maxAmountRequired: selectedPaymentRequirements?.maxAmountRequired,
      settlementRouter: selectedPaymentRequirements?.extra?.settlementRouter,
      transferHook: selectedPaymentRequirements?.extra?.transferHook,
    });

    if (!selectedPaymentRequirements) {
      return new NextResponse(
        JSON.stringify({
          x402Version,
          error:
            errorMessages?.noMatchingRequirements || "Unable to find matching payment requirements",
          accepts: toJsonSafe(paymentRequirements),
        }),
        { status: 402, headers: { "Content-Type": "application/json" } },
      );
    }

    console.log(`[MIDDLEWARE] [${requestId}] [VERIFY_START]`, {
      timestamp: Date.now(),
      elapsed: Date.now() - middlewareStartTime,
      facilitatorUrl: facilitator?.url || "default",
    });

    const verification = await verify(decodedPayment, selectedPaymentRequirements);

    console.log(`[MIDDLEWARE] [${requestId}] [VERIFY_RESULT]`, {
      timestamp: Date.now(),
      elapsed: Date.now() - middlewareStartTime,
      isValid: verification.isValid,
      invalidReason: verification.invalidReason,
      payer: verification.payer,
    });

    if (!verification.isValid) {
      return new NextResponse(
        JSON.stringify({
          x402Version,
          error: errorMessages?.verificationFailed || verification.invalidReason,
          accepts: paymentRequirements,
          payer: verification.payer,
        }),
        { status: 402, headers: { "Content-Type": "application/json" } },
      );
    }

    // Settle payment BEFORE proceeding with request
    // This ensures payment is actually executed on-chain before content is served
    console.log(`[MIDDLEWARE] [${requestId}] [SETTLE_START]`, {
      timestamp: Date.now(),
      elapsed: Date.now() - middlewareStartTime,
      facilitatorUrl: facilitator?.url || "default",
    });

    let settlement;
    try {
      settlement = await settle(decodedPayment, selectedPaymentRequirements);

      console.log(`[MIDDLEWARE] [${requestId}] [SETTLE_RESULT]`, {
        timestamp: Date.now(),
        elapsed: Date.now() - middlewareStartTime,
        success: settlement.success,
        transaction: settlement.transaction,
        network: settlement.network,
        payer: settlement.payer,
        errorReason: settlement.errorReason,
      });
    } catch (error) {
      console.error(`[MIDDLEWARE] [${requestId}] [SETTLE_ERROR]`, {
        timestamp: Date.now(),
        elapsed: Date.now() - middlewareStartTime,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      return new NextResponse(
        JSON.stringify({
          x402Version,
          error:
            errorMessages?.settlementFailed ||
            (error instanceof Error ? error.message : "Settlement failed"),
          accepts: paymentRequirements,
        }),
        { status: 402, headers: { "Content-Type": "application/json" } },
      );
    }

    // If settlement failed, return 402 error - DO NOT proceed with request
    if (!settlement.success) {
      console.error(`[MIDDLEWARE] [${requestId}] [SETTLE_FAILED]`, {
        timestamp: Date.now(),
        elapsed: Date.now() - middlewareStartTime,
        errorReason: settlement.errorReason,
        transaction: settlement.transaction,
      });

      return new NextResponse(
        JSON.stringify({
          x402Version,
          error:
            errorMessages?.settlementFailed ||
            settlement.errorReason ||
            "Payment settlement failed",
          accepts: paymentRequirements,
          payer: settlement.payer,
        }),
        { status: 402, headers: { "Content-Type": "application/json" } },
      );
    }

    // Settlement succeeded - now proceed with request
    const response = await NextResponse.next();

    // if the response from the protected route is >= 400, still include settlement info
    if (response.status >= 400) {
      return response;
    }

    // Add settlement response header
    response.headers.set(
      "X-PAYMENT-RESPONSE",
      safeBase64Encode(
        JSON.stringify({
          success: true,
          transaction: settlement.transaction,
          network: settlement.network,
          payer: settlement.payer,
        }),
      ),
    );

    console.log(`[MIDDLEWARE] [${requestId}] [COMPLETE]`, {
      timestamp: Date.now(),
      totalDuration: Date.now() - middlewareStartTime,
      status: response.status,
    });

    return response;
  };
}

export type {
  Money,
  Network,
  PaymentMiddlewareConfig,
  Resource,
  RouteConfig,
  RoutesConfig,
} from "@secured-finance/sf-x402/types";
export type { Address as SolanaAddress } from "@solana/kit";

// Export session token API handlers for Onramp
export { POST };
