import { OnchainKitProvider } from "@coinbase/onchainkit";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { base, baseSepolia, mainnet, sepolia, filecoin, filecoinCalibration } from "viem/chains";

import { choosePaymentRequirement, isEvmNetwork } from "./paywallUtils";

const queryClient = new QueryClient();

type ProvidersProps = {
  children: ReactNode;
};

/**
 * Providers component for the paywall
 *
 * @param props - The component props
 * @param props.children - The children of the Providers component
 * @returns The Providers component
 */
export function Providers({ children }: ProvidersProps) {
  const {
    testnet = true,
    cdpClientKey,
    appName,
    appLogo,
    paymentRequirements,
    config,
  } = window.x402;
  const selectedRequirement = choosePaymentRequirement(paymentRequirements, testnet);

  // Create wagmi config with custom RPC URLs if available
  const wagmiConfig = useMemo(() => {
    const rpcUrls = config?.rpcUrls || {};

    return createConfig({
      chains: [mainnet, sepolia, base, baseSepolia, filecoin, filecoinCalibration],
      transports: {
        [mainnet.id]: rpcUrls["mainnet"] ? http(rpcUrls["mainnet"]) : http(),
        [sepolia.id]: rpcUrls["sepolia"] ? http(rpcUrls["sepolia"]) : http(),
        [base.id]: rpcUrls["base"] ? http(rpcUrls["base"]) : http(),
        [baseSepolia.id]: rpcUrls["base-sepolia"] ? http(rpcUrls["base-sepolia"]) : http(),
        [filecoin.id]: rpcUrls["filecoin"] ? http(rpcUrls["filecoin"]) : http(),
        [filecoinCalibration.id]: rpcUrls["filecoin-calibration"]
          ? http(rpcUrls["filecoin-calibration"])
          : http(),
      },
    });
  }, [config?.rpcUrls]);

  if (!isEvmNetwork(selectedRequirement.network)) {
    return <>{children}</>;
  }

  // Map network identifier to correct chain
  let chain;
  switch (selectedRequirement.network) {
    case "sepolia":
      chain = sepolia;
      break;
    case "base-sepolia":
      chain = baseSepolia;
      break;
    case "base":
      chain = base;
      break;
    case "filecoin":
      chain = filecoin;
      break;
    case "filecoin-calibration":
      chain = filecoinCalibration;
      break;
    case "mainnet":
    default:
      chain = mainnet;
      break;
  }

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <OnchainKitProvider
          apiKey={cdpClientKey || undefined}
          chain={chain}
          config={{
            appearance: {
              mode: "dark",
              theme: "default",
              name: appName || undefined,
              logo: appLogo || undefined,
            },
            wallet: {
              display: "modal",
              supportedWallets: {
                rabby: true,
                trust: true,
                frame: true,
              },
            },
          }}
        >
          {children}
        </OnchainKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
