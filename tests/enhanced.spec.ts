import { describe, it, expect } from 'vitest';
import { AvalancheClient } from '../src/chains/avalanche.js';
import { estimateBundleGasUsd } from '../src/economics/gas.js';
import type { ClaimBundle } from '../src/types/common.js';

describe('Enhanced Chain Client Tests', () => {
  describe('AvalancheClient gasPrice enhancements', () => {
    it('should handle network errors gracefully', async () => {
      // Use invalid RPC URL to simulate network failure
      const client = new AvalancheClient('http://invalid-url');
      
      const gasPrice = await client.gasPrice();
      
      // Should return fallback value (25 gwei)
      expect(gasPrice).toBe(25000000000n);
    });

    it('should return gasPrice as bigint', async () => {
      const client = new AvalancheClient('http://localhost:8545');
      
      const gasPrice = await client.gasPrice();
      
      expect(typeof gasPrice).toBe('bigint');
      expect(gasPrice).toBeGreaterThan(0n);
    });

    it('should cache gas price to avoid excessive network calls', async () => {
      const client = new AvalancheClient('http://localhost:8545');
      
      // First call should make network request (though it will fail)
      const gasPrice1 = await client.gasPrice();
      
      // Second call should use cache (no additional network call)
      const gasPrice2 = await client.gasPrice();
      
      // Both should return the same value
      expect(gasPrice1).toBe(gasPrice2);
      expect(gasPrice1).toBe(25000000000n); // fallback value
    });
  });

  describe('Dynamic gas estimation with chain client', () => {
    it('should allow dynamic gas estimation with chain client', async () => {
      const client = new AvalancheClient('http://localhost:8545');
      
      const mockBundle: ClaimBundle = {
        id: 'test-bundle',
        chain: 'avalanche',
        protocol: 'test',
        claimTo: { value: '0x123', chain: 'avalanche' },
        items: [
          {
            id: 'reward1',
            wallet: { value: '0x456', chain: 'avalanche' },
            protocol: 'test',
            token: { value: '0x789', chain: 'avalanche' },
            amountWei: '1000000',
            amountUsd: 1.0,
            claimTo: { value: '0x123', chain: 'avalanche' },
            discoveredAt: new Date()
          }
        ],
        totalUsd: 1.0,
        estGasUsd: 0,
        netUsd: 0
      };

      // Test with chain client
      const gasWithClient = await estimateBundleGasUsd(mockBundle, 'avalanche', client);
      expect(gasWithClient).toBeGreaterThan(0);

      // Test without chain client (should use fallback)
      const gasWithoutClient = await estimateBundleGasUsd(mockBundle, 'avalanche');
      expect(gasWithoutClient).toBeGreaterThan(0);
      
      // Both should be positive numbers
      expect(typeof gasWithClient).toBe('number');
      expect(typeof gasWithoutClient).toBe('number');
    });
  });
});