/**
 * Configuration options for Solana (SVM) RPC connections.
 */
export interface SvmConfig {
  /**
   * Custom RPC URL for Solana connections.
   * If not provided, defaults to public Solana RPC endpoints based on network.
   */
  rpcUrl?: string;
}
export interface EvmConfig {
  rpcUrls?: Record<string, string>; // network name -> RPC URL mapping
}

/**
 * Configuration options for X402 client and facilitator operations.
 */
export interface X402Config {
  /** Configuration for Solana (SVM) operations */
  svmConfig?: SvmConfig;
  evmConfig?: EvmConfig;
  // Future: evmConfig?: EvmConfig for EVM-specific configurations
}
