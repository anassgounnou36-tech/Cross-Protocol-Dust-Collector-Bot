import type { ClaimBundle, Chain, ChainClient } from '../types/common.js';

// Gas estimation constants - these would need to be tuned based on real data
const GAS_ESTIMATES = {
  avalanche: {
    baseClaim: 100000,      // Base gas for a simple claim
    perExtraClaim: 80000,   // Additional gas per extra claim in bundle
    gasPrice: 25000000000,  // 25 gwei in wei (fallback)
    nativePrice: 30         // AVAX price in USD
  },
  tron: {
    baseEnergy: 50000,      // Base energy for a simple claim
    perExtraEnergy: 40000,  // Additional energy per extra claim
    energyToTrx: 0.001,     // Energy to TRX conversion rate
    trxPrice: 0.08          // TRX price in USD
  }
};

export async function estimateBundleGasUsd(
  bundle: ClaimBundle, 
  chain: Chain, 
  chainClient?: ChainClient
): Promise<number> {
  try {
    if (chain === 'avalanche') {
      const estimates = GAS_ESTIMATES.avalanche;
      const totalGas = estimates.baseClaim + (bundle.items.length - 1) * estimates.perExtraClaim;
      
      // Use dynamic gas price from chain client if available
      let gasPriceWei: bigint;
      if (chainClient && chainClient.chain === 'avalanche') {
        try {
          gasPriceWei = await chainClient.gasPrice();
        } catch (error) {
          console.warn('Failed to get dynamic gas price, using fallback:', error instanceof Error ? error.message : 'Unknown error');
          gasPriceWei = BigInt(estimates.gasPrice);
        }
      } else {
        gasPriceWei = BigInt(estimates.gasPrice);
      }
      
      const gasCostWei = BigInt(totalGas) * gasPriceWei;
      const gasCostEth = Number(gasCostWei) / 1e18;
      
      // Use dynamic native price if available
      let nativePrice = estimates.nativePrice;
      if (chainClient && chainClient.chain === 'avalanche') {
        try {
          nativePrice = await chainClient.nativeUsd();
        } catch (error) {
          console.warn('Failed to get dynamic native price, using fallback:', error instanceof Error ? error.message : 'Unknown error');
        }
      }
      
      return gasCostEth * nativePrice;
    }
    
    if (chain === 'tron') {
      const estimates = GAS_ESTIMATES.tron;
      const totalEnergy = estimates.baseEnergy + (bundle.items.length - 1) * estimates.perExtraEnergy;
      
      // For Tron, we could also use dynamic pricing if chain client is available
      let energyToTrx = estimates.energyToTrx;
      let trxPrice = estimates.trxPrice;
      
      if (chainClient && chainClient.chain === 'tron') {
        try {
          // Tron gasPrice returns energy units, so we can use that
          const energyUnits = await chainClient.gasPrice();
          if (energyUnits > 0n) {
            energyToTrx = Number(energyUnits) / 1000000; // Convert to TRX ratio
          }
          trxPrice = await chainClient.nativeUsd();
        } catch (error) {
          console.warn('Failed to get dynamic Tron pricing, using fallback:', error instanceof Error ? error.message : 'Unknown error');
        }
      }
      
      const energyCostTrx = totalEnergy * energyToTrx;
      return energyCostTrx * trxPrice;
    }

    console.warn(`Unknown chain for gas estimation: ${chain}`);
    return 0;
  } catch (error) {
    console.error(`Failed to estimate gas for bundle ${bundle.id}:`, error);
    return 0;
  }
}

// Legacy synchronous version for backwards compatibility
export function estimateBundleGasUsdSync(bundle: ClaimBundle, chain: Chain): number {
  if (chain === 'avalanche') {
    const estimates = GAS_ESTIMATES.avalanche;
    const totalGas = estimates.baseClaim + (bundle.items.length - 1) * estimates.perExtraClaim;
    const gasCostWei = BigInt(totalGas) * BigInt(estimates.gasPrice);
    const gasCostEth = Number(gasCostWei) / 1e18;
    return gasCostEth * estimates.nativePrice;
  }
  
  if (chain === 'tron') {
    const estimates = GAS_ESTIMATES.tron;
    const totalEnergy = estimates.baseEnergy + (bundle.items.length - 1) * estimates.perExtraEnergy;
    const energyCostTrx = totalEnergy * estimates.energyToTrx;
    return energyCostTrx * estimates.trxPrice;
  }

  return 0;
}

// Simple async wrapper that uses fallback estimates
export async function estimateBundleUsd(bundle: ClaimBundle): Promise<number> {
  return estimateBundleGasUsdSync(bundle, bundle.chain);
}

export function estimateClaimGasUsd(chain: Chain, itemCount: number = 1): number {
  const mockBundle = {
    id: 'estimate',
    chain,
    protocol: 'mock',
    claimTo: { value: '0x0', chain },
    items: new Array(itemCount).fill(null),
    totalUsd: 0,
    estGasUsd: 0,
    netUsd: 0
  };
  
  return estimateBundleGasUsdSync(mockBundle, chain);
}

// Helper function to validate gas estimates are reasonable
export function validateGasEstimate(gasUsd: number, totalUsd: number): boolean {
  // Gas should not exceed 50% of total value
  const maxGasRatio = 0.5;
  const gasRatio = gasUsd / totalUsd;
  
  if (gasRatio > maxGasRatio) {
    console.warn(`Gas estimate too high: ${gasUsd} USD gas for ${totalUsd} USD value (${(gasRatio * 100).toFixed(1)}%)`);
    return false;
  }
  
  return true;
}

// Update gas estimates based on actual execution data
// This would be called after successful executions to improve estimates
export function updateGasEstimates(
  chain: Chain, 
  itemCount: number, 
  actualGasUsd: number
): void {
  // TODO: Implement learning mechanism to improve gas estimates
  // Could use a rolling average or more sophisticated ML approach
  console.log(`Gas estimate feedback: ${chain} with ${itemCount} items cost ${actualGasUsd} USD`);
}