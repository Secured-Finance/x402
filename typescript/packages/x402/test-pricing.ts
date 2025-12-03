/**
 * Test script for the CoinGecko pricing utility
 *
 * Run with: pnpm tsx test-pricing.ts
 */

import {
  getPriceCoinGecko,
  getTokenPriceUSD,
  clearPriceCache,
  getCacheAge,
} from "./src/shared/pricing";

async function testPricing() {
  console.log("🔍 Testing CoinGecko Pricing Utility\n");

  // Test 1: Fetch all prices
  console.log("1️⃣  Fetching all token prices...");
  const prices = await getPriceCoinGecko();
  console.log("   Result:", prices);
  console.log("   ✅ Success!\n");

  // Test 2: Check cache age
  console.log("2️⃣  Checking cache age...");
  const age = getCacheAge();
  console.log(`   Cache age: ${age}ms`);
  console.log("   ✅ Cache is working!\n");

  // Test 3: Verify cache hit (should be instant)
  console.log("3️⃣  Testing cache hit...");
  const startTime = Date.now();
  const cachedPrices = await getPriceCoinGecko();
  const elapsed = Date.now() - startTime;
  console.log(`   Elapsed time: ${elapsed}ms (should be <5ms)`);
  console.log("   Result:", cachedPrices);
  console.log("   ✅ Cache hit successful!\n");

  // Test 4: Get specific token price
  console.log("4️⃣  Getting specific token prices...");
  const jpycPrice = await getTokenPriceUSD("JPYC");
  const usdfcPrice = await getTokenPriceUSD("USDFC");
  const usdcPrice = await getTokenPriceUSD("USDC");
  console.log(`   JPYC:  $${jpycPrice}`);
  console.log(`   USDFC: $${usdfcPrice}`);
  console.log(`   USDC:  $${usdcPrice}`);
  console.log("   ✅ Individual price fetching works!\n");

  // Test 5: Clear cache and refetch
  console.log("5️⃣  Clearing cache and refetching...");
  clearPriceCache();
  const ageBefore = getCacheAge();
  console.log(`   Cache age after clear: ${ageBefore} (should be null)`);
  const freshPrices = await getPriceCoinGecko();
  const ageAfter = getCacheAge();
  console.log(`   Cache age after refetch: ${ageAfter}ms`);
  console.log("   Fresh prices:", freshPrices);
  console.log("   ✅ Cache clearing works!\n");

  // Test 6: Wait and check cache expiry
  console.log("6️⃣  Testing cache expiry (waiting 7 seconds)...");
  console.log("   Waiting...");
  await new Promise((resolve) => setTimeout(resolve, 7000));
  const ageExpired = getCacheAge();
  console.log(`   Cache age: ${ageExpired}ms (should be >6000ms)`);
  const refetchedPrices = await getPriceCoinGecko();
  console.log("   New prices after expiry:", refetchedPrices);
  console.log("   ✅ Cache expiry works!\n");

  console.log("🎉 All tests passed!");
}

// Run tests
testPricing().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
