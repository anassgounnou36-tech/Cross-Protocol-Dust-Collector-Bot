import { ethers } from 'ethers';
import type { ChainClient, ClaimBundle, SimulationResult, TxResult } from '../types/common.js';

export class AvalancheClient implements ChainClient {
  readonly chain = 'avalanche' as const;
  private provider: ethers.JsonRpcProvider;
  private wallet?: ethers.Wallet;
  private gasPriceCache?: { price: bigint; timestamp: number };
  private readonly CACHE_TTL_MS = 30000; // 30 seconds cache

  constructor(rpcUrl: string, privateKey?: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    
    if (privateKey) {
      this.wallet = new ethers.Wallet(privateKey, this.provider);
    }
  }

  async gasPrice(): Promise<bigint> {
    try {
      // Check cache first
      if (this.gasPriceCache) {
        const age = Date.now() - this.gasPriceCache.timestamp;
        if (age < this.CACHE_TTL_MS) {
          return this.gasPriceCache.price;
        }
      }

      const feeData = await this.provider.getFeeData();
      
      let gasPrice: bigint;
      
      // Handle EIP-1559 vs legacy gas pricing
      if (feeData.gasPrice) {
        gasPrice = feeData.gasPrice;
      } else if (feeData.maxFeePerGas) {
        // For EIP-1559, use maxFeePerGas as fallback
        gasPrice = feeData.maxFeePerGas;
      } else {
        // Final fallback - 25 gwei default for Avalanche
        gasPrice = 25000000000n;
      }

      // Cache the result
      this.gasPriceCache = {
        price: gasPrice,
        timestamp: Date.now()
      };

      return gasPrice;
    } catch (error) {
      console.warn('Failed to fetch gas price from network, using default:', error instanceof Error ? error.message : 'Unknown error');
      
      // Return cached value if available, otherwise use default
      if (this.gasPriceCache) {
        return this.gasPriceCache.price;
      }
      
      // Return safe default on network failure
      return 25000000000n; // 25 gwei default
    }
  }

  async nativeUsd(): Promise<number> {
    // TODO: Implement real AVAX price fetching from CoinGecko or DEX
    return 30.0; // Placeholder AVAX price
  }

  async simulate(bundle: ClaimBundle): Promise<SimulationResult> {
    try {
      if (!this.wallet) {
        return { ok: false, reason: 'No wallet configured for simulation' };
      }

      // TODO: Implement actual simulation logic
      // For now, just check if we have enough balance for gas
      const balance = await this.wallet?.provider?.getBalance(this.wallet.address) || 0n;
      const gasPrice = await this.gasPrice();
      const estimatedGas = 21000n * BigInt(bundle.items.length); // Rough estimate
      const gasRequired = gasPrice * estimatedGas;

      if (balance < gasRequired) {
        return { 
          ok: false, 
          reason: `Insufficient balance for gas. Required: ${ethers.formatEther(gasRequired)} AVAX` 
        };
      }

      return { ok: true };
    } catch (error) {
      return { 
        ok: false, 
        reason: `Simulation failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  async sendRaw(bundle: ClaimBundle): Promise<TxResult> {
    try {
      if (!this.wallet) {
        throw new Error('No wallet configured for execution');
      }

      // TODO: Implement actual claim transaction logic
      // This is a placeholder that would need real protocol-specific logic
      
      const gasPrice = await this.gasPrice();
      const gasLimit = 100000n * BigInt(bundle.items.length);
      
      // Simulate a successful transaction for mock mode
      const mockTxHash = `0x${Math.random().toString(16).substr(2, 64)}`;
      const gasUsed = gasLimit * 7n / 10n; // Assume 70% of gas limit used
      const gasUsdCost = Number(gasUsed * gasPrice) / 1e18 * await this.nativeUsd();

      return {
        success: true,
        txHash: mockTxHash,
        gasUsed: gasUsed.toString(),
        gasUsd: gasUsdCost,
        claimedUsd: bundle.totalUsd
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        claimedUsd: 0
      };
    }
  }

  async getBalance(address: string): Promise<bigint> {
    return this.provider.getBalance(address);
  }

  async getBlockNumber(): Promise<number> {
    return this.provider.getBlockNumber();
  }
}