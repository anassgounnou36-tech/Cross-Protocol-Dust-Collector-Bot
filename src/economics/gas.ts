import type { ClaimBundle, Chain } from '../types/common.js';

// Gas estimation constants - these would need to be tuned based on real data
const GAS_ESTIMATES = {
  avalanche: {
    baseClaim: 100000,      // Base gas for a simple claim
    perExtraClaim: 80000,   // Additional gas per extra claim in bundle
    gasPrice: 25000000000,  // 25 gwei in wei
    nativePrice: 30         // AVAX price in USD
  },
  tron: {
    baseEnergy: 50000,      // Base energy for a simple claim
    perExtraEnergy: 40000,  // Additional energy per extra claim
    energyToTrx: 0.001,     // Energy to TRX conversion rate
    trxPrice: 0.08          // TRX price in USD
  }
} as const;

export function estimateBundleGasUsd(bundle: ClaimBundle, chain: Chain): number {
  try {
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

    console.warn(`Unknown chain for gas estimation: ${chain}`);
    return 0;
  } catch (error) {
    console.error(`Failed to estimate gas for bundle ${bundle.id}:`, error);
    return 0;
  }
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
  
  return estimateBundleGasUsd(mockBundle, chain);
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