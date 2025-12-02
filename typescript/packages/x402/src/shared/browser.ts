// Browser-safe shared utilities - NO server-only dependencies
//
// This file re-exports shared utilities that are safe to use in browser environments.
// Server-only utilities (like pricing.ts which depends on coingecko-api) are NOT exported here.

export * from "./json";
export * from "./base64";
export * from "./network";
export * from "./middleware";
export * as svm from "./svm";
export * from "./evm";

// NOTE: pricing.ts is intentionally NOT exported here
// It contains server-only dependencies (coingecko-api) that cannot run in browsers
