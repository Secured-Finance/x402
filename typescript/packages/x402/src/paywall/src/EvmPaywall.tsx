import { FundButton, getOnrampBuyUrl } from "@coinbase/onchainkit/fund";
import { Avatar, Name } from "@coinbase/onchainkit/identity";
import {
  ConnectWallet,
  Wallet,
  WalletDropdown,
  WalletDropdownDisconnect,
} from "@coinbase/onchainkit/wallet";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPublicClient, formatUnits, http, publicActions } from "viem";
import { base, baseSepolia, mainnet, sepolia, filecoin, filecoinCalibration } from "viem/chains";
import { useAccount, useSwitchChain, useWalletClient } from "wagmi";

import type { PaymentRequirements } from "../../types/verify";
import { exact } from "../../schemes";
import { getStablecoinBalance, getStablecoinSymbol } from "../../shared/evm";
import type { Network } from "../../types/shared";

import { Spinner } from "./Spinner";
import { useOnrampSessionToken } from "./useOnrampSessionToken";
import { ensureValidAmount } from "./utils";
import { getNetworkDisplayName, isTestnetNetwork } from "./paywallUtils";

type EvmPaywallProps = {
  paymentRequirement: PaymentRequirements;
  onSuccessfulResponse: (response: Response) => Promise<void>;
};

/**
 * Paywall experience for EVM networks.
 *
 * @param props - Component props.
 * @param props.paymentRequirement - Payment requirement evaluated for the protected resource.
 * @param props.onSuccessfulResponse - Callback fired once the 402 fetch succeeds.
 * @returns JSX element.
 */
export function EvmPaywall({ paymentRequirement, onSuccessfulResponse }: EvmPaywallProps) {
  const { address, isConnected, chainId: connectedChainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { data: wagmiWalletClient } = useWalletClient();
  const { sessionToken } = useOnrampSessionToken(address);

  const [status, setStatus] = useState<string>("");
  const [isCorrectChain, setIsCorrectChain] = useState<boolean | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [formattedStableBalance, setFormattedStableBalance] = useState<string>("");
  const [stableSymbol, setStableSymbol] = useState<string>("USDC");
  const [hideBalance, setHideBalance] = useState(true);

  const x402 = window.x402;
  // Get decimals from payment requirements, default to 6 for backwards compatibility
  const decimals = (paymentRequirement.extra?.decimals as number) ?? 6;
  const amount =
    typeof x402.amount === "number"
      ? x402.amount
      : Number(paymentRequirement.maxAmountRequired ?? 0) / 10 ** decimals;

  const network = paymentRequirement.network as Network;
  // Map network identifier to correct chain
  let paymentChain;
  switch (network) {
    case "sepolia":
      paymentChain = sepolia;
      break;
    case "base-sepolia":
      paymentChain = baseSepolia;
      break;
    case "base":
      paymentChain = base;
      break;
    case "filecoin-calibration":
      paymentChain = filecoinCalibration;
      break;
    case "filecoin":
      paymentChain = filecoin;
      break;
    case "mainnet":
    default:
      paymentChain = mainnet;
      break;
  }
  const chainId = paymentChain.id;
  const chainName = getNetworkDisplayName(network);
  const testnet = isTestnetNetwork(network);
  const showOnramp = Boolean(!testnet && isConnected && x402.sessionTokenEndpoint);

  const publicClient = useMemo(
    () =>
      createPublicClient({
        chain: paymentChain,
        transport: http(),
      }).extend(publicActions),
    [paymentChain],
  );

  const checkStableBalance = useCallback(async () => {
    if (!address) {
      return;
    }
    const balance = await getStablecoinBalance(publicClient, address);
    const formattedBalance = formatUnits(balance, decimals);
    // Format to 2-4 decimal places for cleaner display
    const num = parseFloat(formattedBalance);
    const formatted = num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
    setFormattedStableBalance(formatted);
  }, [address, publicClient, decimals]);

  const handleSwitchChain = useCallback(async () => {
    if (isCorrectChain) {
      return;
    }

    try {
      setStatus("");
      await switchChainAsync({ chainId });
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to switch network");
    }
  }, [switchChainAsync, chainId, isCorrectChain]);

  useEffect(() => {
    if (!address) {
      return;
    }

    void handleSwitchChain();
    // Resolve symbol dynamically (USDC/USDFC)
    const symbol = getStablecoinSymbol(publicClient) || "USDC";
    setStableSymbol(symbol);
    void checkStableBalance();
  }, [address, handleSwitchChain, checkStableBalance, publicClient]);

  useEffect(() => {
    if (isConnected && chainId === connectedChainId) {
      setIsCorrectChain(true);
      setStatus("");
    } else if (isConnected && chainId !== connectedChainId) {
      setIsCorrectChain(false);
      setStatus(`On the wrong network. Please switch to ${chainName}.`);
    } else {
      setIsCorrectChain(null);
      setStatus("");
    }
  }, [chainId, connectedChainId, isConnected, chainName]);

  const onrampBuyUrl = useMemo(() => {
    if (!sessionToken) {
      return undefined;
    }
    return getOnrampBuyUrl({
      presetFiatAmount: 2,
      fiatCurrency: "USD",
      sessionToken,
    });
  }, [sessionToken]);

  const handlePayment = useCallback(async () => {
    if (!address || !x402) {
      return;
    }

    await handleSwitchChain();

    if (!wagmiWalletClient) {
      setStatus("Wallet client not available. Please reconnect your wallet.");
      return;
    }
    const walletClient = wagmiWalletClient.extend(publicActions);

    setIsPaying(true);

    try {
      setStatus(`Checking ${stableSymbol} balance...`);
      const balance = await getStablecoinBalance(publicClient, address);

      if (balance === 0n) {
        throw new Error(`Insufficient balance. Make sure you have ${stableSymbol} on ${chainName}`);
      }

      setStatus("Creating payment signature...");
      const validPaymentRequirements = ensureValidAmount(paymentRequirement);
      const initialPayment = await exact.evm.createPayment(
        walletClient,
        1,
        validPaymentRequirements,
      );

      const paymentHeader: string = exact.evm.encodePayment(initialPayment);

      setStatus("Requesting content with payment...");
      const response = await fetch(x402.currentUrl, {
        headers: {
          "X-PAYMENT": paymentHeader,
          "Access-Control-Expose-Headers": "X-PAYMENT-RESPONSE",
        },
      });

      if (response.ok) {
        await onSuccessfulResponse(response);
      } else if (response.status === 402) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData && typeof errorData.x402Version === "number") {
          const retryPayment = await exact.evm.createPayment(
            walletClient,
            errorData.x402Version,
            validPaymentRequirements,
          );

          retryPayment.x402Version = errorData.x402Version;
          const retryHeader = exact.evm.encodePayment(retryPayment);
          const retryResponse = await fetch(x402.currentUrl, {
            headers: {
              "X-PAYMENT": retryHeader,
              "Access-Control-Expose-Headers": "X-PAYMENT-RESPONSE",
            },
          });
          if (retryResponse.ok) {
            await onSuccessfulResponse(retryResponse);
            return;
          } else {
            throw new Error(`Payment retry failed: ${retryResponse.statusText}`);
          }
        } else {
          throw new Error(`Payment failed: ${response.statusText}`);
        }
      } else {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Payment failed");
    } finally {
      setIsPaying(false);
    }
  }, [
    address,
    x402,
    paymentRequirement,
    handleSwitchChain,
    wagmiWalletClient,
    publicClient,
    chainName,
    onSuccessfulResponse,
    stableSymbol,
  ]);

  if (!x402) {
    return null;
  }

  return (
    <div className="container gap-8">
      <div className="header">
        <h1 className="title">Payment Required</h1>
        <p>
          {paymentRequirement.description && `${paymentRequirement.description}.`} To access this
          content, please pay ${amount} {chainName} {stableSymbol}.
        </p>
        {testnet && (
          <p className="instructions">
            Need {chainName} {stableSymbol}?{" "}
            <a href="https://faucet.circle.com/" target="_blank" rel="noopener noreferrer">
              Get some <u>here</u>.
            </a>
          </p>
        )}
      </div>

      <div className="content w-full">
        <Wallet className="w-full">
          <ConnectWallet className="w-full py-3" disconnectedLabel="Connect wallet">
            <Avatar className="h-5 w-5 opacity-80" />
            <Name className="opacity-80 text-sm" />
          </ConnectWallet>
          <WalletDropdown>
            <WalletDropdownDisconnect className="opacity-80" />
          </WalletDropdown>
        </Wallet>
        {isConnected && (
          <div id="payment-section">
            <div className="payment-details">
              <div className="payment-row">
                <span className="payment-label">Wallet:</span>
                <span className="payment-value">
                  {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Loading..."}
                </span>
              </div>
              <div className="payment-row">
                <span className="payment-label">Available balance:</span>
                <span className="payment-value">
                  <button className="balance-button" onClick={() => setHideBalance(prev => !prev)}>
                    {formattedStableBalance && !hideBalance
                      ? `${formattedStableBalance} ${stableSymbol}`
                      : `••••• ${stableSymbol}`}
                  </button>
                </span>
              </div>
              <div className="payment-row">
                <span className="payment-label">Amount:</span>
                <span className="payment-value">${amount} {stableSymbol}</span>
              </div>
              <div className="payment-row">
                <span className="payment-label">Network:</span>
                <span className="payment-value">{chainName}</span>
              </div>
            </div>

            {isCorrectChain ? (
              <div className="cta-container">
                {showOnramp && (
                  <FundButton
                    fundingUrl={onrampBuyUrl}
                    text="Get more USDC"
                    hideIcon
                    className="button button-positive"
                  />
                )}
                <button
                  className="button button-primary"
                  onClick={handlePayment}
                  disabled={isPaying}
                >
                  {isPaying ? <Spinner /> : "Pay now"}
                </button>
              </div>
            ) : (
              <button className="button button-primary" onClick={handleSwitchChain}>
                Switch to {chainName}
              </button>
            )}
          </div>
        )}
        {status && <div className="status">{status}</div>}
      </div>
    </div>
  );
}
