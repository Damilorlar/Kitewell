import { describe, it, expect } from "vitest";
import { calculateAvailableBalance } from "./stellar";

describe("calculateAvailableBalance", () => {
  describe("XLM (native asset)", () => {
    it("calculates available balance with two subentries", () => {
      const balance = {
        balance: "100",
        selling_liabilities: "10",
        buying_liabilities: "5",
      };

      // With 2 subentries: min_balance = 0.5 * (2 + 2) = 2 XLM
      // available = 100 - 2 - 10 = 88
      const available = calculateAvailableBalance(balance, true, 2, 0.5);
      expect(available).toBe("88.0000000");
    });

    it("calculates available balance with zero subentries", () => {
      const balance = {
        balance: "50",
        selling_liabilities: "5",
      };

      // With 0 subentries: min_balance = 0.5 * (2 + 0) = 1 XLM
      // available = 50 - 1 - 5 = 44
      const available = calculateAvailableBalance(balance, true, 0, 0.5);
      expect(available).toBe("44.0000000");
    });

    it("treats missing liabilities as zero", () => {
      const balance = {
        balance: "100",
      };

      // With 1 subentry: min_balance = 0.5 * (2 + 1) = 1.5 XLM
      // available = 100 - 1.5 - 0 = 98.5
      const available = calculateAvailableBalance(balance, true, 1, 0.5);
      expect(available).toBe("98.5000000");
    });

    it("returns zero for negative available balance", () => {
      const balance = {
        balance: "2",
        selling_liabilities: "1",
      };

      // With 5 subentries: min_balance = 0.5 * (2 + 5) = 3.5 XLM
      // available = 2 - 3.5 - 1 = -2.5 → clamped to 0
      const available = calculateAvailableBalance(balance, true, 5, 0.5);
      expect(available).toBe("0.0000000");
    });

    it("accounts for selling liabilities", () => {
      const balance = {
        balance: "100",
        selling_liabilities: "20",
        buying_liabilities: "10",
      };

      // With 1 subentry: min_balance = 0.5 * (2 + 1) = 1.5 XLM
      // available = 100 - 1.5 - 20 = 78.5
      const available = calculateAvailableBalance(balance, true, 1, 0.5);
      expect(available).toBe("78.5000000");
    });

    it("uses custom base reserve", () => {
      const balance = {
        balance: "100",
        selling_liabilities: "0",
      };

      // With 1 subentry and 1.0 base reserve: min_balance = 1.0 * (2 + 1) = 3 XLM
      // available = 100 - 3 - 0 = 97
      const available = calculateAvailableBalance(balance, true, 1, 1.0);
      expect(available).toBe("97.0000000");
    });
  });

  describe("credit assets", () => {
    it("calculates available balance for credit asset", () => {
      const balance = {
        balance: "500",
        selling_liabilities: "50",
        buying_liabilities: "25",
      };

      // For credit assets: available = total - selling liabilities
      // available = 500 - 50 = 450
      const available = calculateAvailableBalance(balance, false);
      expect(available).toBe("450.0000000");
    });

    it("treats missing liabilities as zero", () => {
      const balance = {
        balance: "1000",
      };

      // available = 1000 - 0 = 1000
      const available = calculateAvailableBalance(balance, false);
      expect(available).toBe("1000.0000000");
    });

    it("returns zero for negative available balance", () => {
      const balance = {
        balance: "100",
        selling_liabilities: "150",
      };

      // available = 100 - 150 = -50 → clamped to 0
      const available = calculateAvailableBalance(balance, false);
      expect(available).toBe("0.0000000");
    });

    it("ignores subentry count for credit assets", () => {
      const balance = {
        balance: "200",
        selling_liabilities: "20",
      };

      // Subentry count and base reserve should be ignored for credit assets
      // available = 200 - 20 = 180
      const available = calculateAvailableBalance(balance, false, 10, 2.0);
      expect(available).toBe("180.0000000");
    });
  });

  describe("edge cases", () => {
    it("handles string inputs", () => {
      const balance = {
        balance: "100.5",
        selling_liabilities: "10.25",
      };

      const available = calculateAvailableBalance(balance, true, 1, 0.5);
      // available = 100.5 - 1.5 - 10.25 = 88.75
      expect(available).toBe("88.7500000");
    });

    it("handles zero balance", () => {
      const balance = {
        balance: "0",
        selling_liabilities: "0",
      };

      const available = calculateAvailableBalance(balance, true, 1, 0.5);
      // available = 0 - 1.5 - 0 = -1.5 → clamped to 0
      expect(available).toBe("0.0000000");
    });
  });
});
