import { OnchainKitProvider } from "@coinbase/onchainkit";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { base, baseSepolia, mainnet, sepolia } from "viem/chains";

import { choosePaymentRequirement, isEvmNetwork } from "./paywallUtils";
import "./window.d.ts";

const queryClient = new QueryClient();

// Create wagmi config with all supported chains
const wagmiConfig = createConfig({
  chains: [mainnet, sepolia, base, baseSepolia],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [base.id]: http(),
    [baseSepolia.id]: http(),
  },
});

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
  const { testnet = true, cdpClientKey, appName, appLogo, paymentRequirements } = window.x402;
  const selectedRequirement = choosePaymentRequirement(paymentRequirements, testnet);

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
