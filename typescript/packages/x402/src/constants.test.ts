import { describe, it, expect } from "vitest";
import { calculateFee, usdToAtomic } from "./constants";

describe("calculateFee", () => {
  describe("6-decimal tokens (USDC)", () => {
    it("applies minimum fee for small amounts", () => {
      const totalAmount = BigInt(1000000); // 1.00 USDC
      const { feeAmount, merchantAmount } = calculateFee(totalAmount, 6);

      // 0.3% of 1.00 USDC = 0.003 USDC = 3000 atomic units
      // Minimum fee = 0.01 USDC = 10000 atomic units
      // Should use minimum fee
      expect(feeAmount).toBe(BigInt(10000)); // 0.01 USDC
      expect(merchantAmount).toBe(BigInt(990000)); // 0.99 USDC
      expect(feeAmount + merchantAmount).toBe(totalAmount);
    });

    it("applies percentage fee for larger amounts", () => {
      const totalAmount = BigInt(10000000); // 10.00 USDC
      const { feeAmount, merchantAmount } = calculateFee(totalAmount, 6);

      // 0.3% of 10.00 USDC = 0.03 USDC = 30000 atomic units
      // Minimum fee = 0.01 USDC = 10000 atomic units
      // Should use percentage fee (larger than minimum)
      expect(feeAmount).toBe(BigInt(30000)); // 0.03 USDC
      expect(merchantAmount).toBe(BigInt(9970000)); // 9.97 USDC
      expect(feeAmount + merchantAmount).toBe(totalAmount);
    });
  });

  describe("18-decimal tokens (JPYC/USDFC)", () => {
    it("applies minimum fee for small amounts", () => {
      const totalAmount = BigInt("1000000000000000000"); // 1.00 JPYC
      const { feeAmount, merchantAmount } = calculateFee(totalAmount, 18);

      // 0.3% of 1.00 JPYC = 0.003 JPYC = 3000000000000000 atomic units
      // Minimum fee = 0.01 JPYC = 10000000000000000 atomic units
      // Should use minimum fee
      expect(feeAmount).toBe(BigInt("10000000000000000")); // 0.01 JPYC
      expect(merchantAmount).toBe(BigInt("990000000000000000")); // 0.99 JPYC
      expect(feeAmount + merchantAmount).toBe(totalAmount);
    });

    it("applies percentage fee for larger amounts", () => {
      const totalAmount = BigInt("10000000000000000000"); // 10.00 JPYC
      const { feeAmount, merchantAmount } = calculateFee(totalAmount, 18);

      // 0.3% of 10.00 JPYC = 0.03 JPYC = 30000000000000000 atomic units
      // Minimum fee = 0.01 JPYC = 10000000000000000 atomic units
      // Should use percentage fee (larger than minimum)
      expect(feeAmount).toBe(BigInt("30000000000000000")); // 0.03 JPYC
      expect(merchantAmount).toBe(BigInt("9970000000000000000")); // 9.97 JPYC
      expect(feeAmount + merchantAmount).toBe(totalAmount);
    });
  });

  describe("edge cases", () => {
    it("handles very small amounts (below minimum fee)", () => {
      const totalAmount = BigInt(1000); // 0.001 USDC
      const { feeAmount, merchantAmount } = calculateFee(totalAmount, 6);

      // Total is less than minimum fee - should still apply minimum
      expect(feeAmount).toBe(BigInt(10000)); // 0.01 USDC
      // Merchant amount would be negative, but we still calculate it
      expect(feeAmount + merchantAmount).toBe(totalAmount);
    });

    it("handles exact minimum fee amount", () => {
      const totalAmount = BigInt(10000); // 0.01 USDC (exactly the minimum fee)
      const { feeAmount, merchantAmount } = calculateFee(totalAmount, 6);

      // 0.3% of 0.01 USDC = 0.00003 USDC = 30 atomic units
      // Minimum fee = 10000
      expect(feeAmount).toBe(BigInt(10000));
      expect(merchantAmount).toBe(BigInt(0));
      expect(feeAmount + merchantAmount).toBe(totalAmount);
    });
  });
});

describe("usdToAtomic", () => {
  describe("6-decimal tokens (USDC)", () => {
    it("converts whole dollar amounts", () => {
      expect(usdToAtomic(1, 6)).toBe("1000000");
      expect(usdToAtomic(10, 6)).toBe("10000000");
      expect(usdToAtomic(100, 6)).toBe("100000000");
    });

    it("converts amounts with cents", () => {
      expect(usdToAtomic(1.25, 6)).toBe("1250000");
      expect(usdToAtomic(0.01, 6)).toBe("10000");
      expect(usdToAtomic(0.99, 6)).toBe("990000");
    });

    it("handles many decimal places (truncates beyond token decimals)", () => {
      expect(usdToAtomic(1.123456, 6)).toBe("1123456");
      expect(usdToAtomic(1.1234567, 6)).toBe("1123456"); // 7th decimal truncated
      expect(usdToAtomic(0.0001, 6)).toBe("100");
    });
  });

  describe("18-decimal tokens (JPYC/USDFC)", () => {
    it("converts whole dollar amounts", () => {
      expect(usdToAtomic(1, 18)).toBe("1000000000000000000");
      expect(usdToAtomic(10, 18)).toBe("10000000000000000000");
    });

    it("converts amounts with cents", () => {
      expect(usdToAtomic(1.25, 18)).toBe("1250000000000000000");
      expect(usdToAtomic(0.01, 18)).toBe("10000000000000000");
      expect(usdToAtomic(0.99, 18)).toBe("990000000000000000");
    });

    it("handles many decimal places", () => {
      expect(usdToAtomic(1.123456789012345678, 18)).toBe("1123456789012345678");
      expect(usdToAtomic(0.000000000000000001, 18)).toBe("1"); // Smallest unit
    });
  });

  describe("precision edge cases", () => {
    it("handles floating point precision issues correctly", () => {
      // These amounts can be problematic with floating-point math
      expect(usdToAtomic(0.1 + 0.2, 6)).toBe("300000"); // 0.3 (avoids 0.30000000000000004)
      expect(usdToAtomic(1.005, 6)).toBe("1005000");
    });

    it("pads fractional part with zeros when needed", () => {
      expect(usdToAtomic(1.1, 6)).toBe("1100000"); // .1 becomes .100000
      expect(usdToAtomic(5, 6)).toBe("5000000"); // No decimal becomes .000000
    });
  });
});
