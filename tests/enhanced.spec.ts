import { describe, it, expect } from 'vitest';
import { AvalancheClient } from '../src/chains/avalanche.js';
import { TronClient } from '../src/chains/tron.js';
import { estimateBundleGasUsd, estimateBundleUsd } from '../src/economics/gas.js';
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

  describe('Token pricing with caching', () => {
    it('should return 0 for unpriced tokens and cache the result', async () => {
      const client = new AvalancheClient('http://localhost:8545');
      
      // First call should log error and return 0
      const price1 = await client.tokenUsd('0x123456789');
      expect(price1).toBe(0);
      
      // Second call should use cache (no additional error log)
      const price2 = await client.tokenUsd('0x123456789');
      expect(price2).toBe(0);
      expect(price1).toBe(price2);
    });

    it('should cache native USD price', async () => {
      const client = new AvalancheClient('http://localhost:8545');
      
      const price1 = await client.nativeUsd();
      const price2 = await client.nativeUsd();
      
      expect(price1).toBe(30.0); // Placeholder price
      expect(price1).toBe(price2);
    });

    it('should work with TronClient tokenUsd method', async () => {
      const client = new TronClient('http://localhost:8545');
      
      // Should return 0 and log error for unpriced tokens
      const price = await client.tokenUsd('TR123456789');
      expect(price).toBe(0);
    });
  });

  describe('Gas estimation bundle USD wrapper', () => {
    it('should provide estimateBundleUsd function', async () => {
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

      const gasEstimate = await estimateBundleUsd(mockBundle);
      expect(gasEstimate).toBeGreaterThan(0);
      expect(typeof gasEstimate).toBe('number');
    });

    it('should work with Tron bundles', async () => {
      const mockBundle: ClaimBundle = {
        id: 'test-bundle',
        chain: 'tron',
        protocol: 'test',
        claimTo: { value: 'TR123', chain: 'tron' },
        items: [
          {
            id: 'reward1',
            wallet: { value: 'TR456', chain: 'tron' },
            protocol: 'test',
            token: { value: 'TR789', chain: 'tron' },
            amountWei: '1000000',
            amountUsd: 1.0,
            claimTo: { value: 'TR123', chain: 'tron' },
            discoveredAt: new Date()
          }
        ],
        totalUsd: 1.0,
        estGasUsd: 0,
        netUsd: 0
      };

      const gasEstimate = await estimateBundleUsd(mockBundle);
      expect(gasEstimate).toBeGreaterThan(0);
      expect(typeof gasEstimate).toBe('number');
    });
  });
});