import type { ClaimBundle, ChainClient, TxResult } from '../types/common.js';
import { logger } from './logger.js';

export async function execute(
  bundle: ClaimBundle, 
  clients: Map<string, ChainClient>
): Promise<TxResult> {
  try {
    const client = clients.get(bundle.chain);
    
    if (!client) {
      const error = `No client configured for chain: ${bundle.chain}`;
      logger.error(`Execution failed for bundle ${bundle.id}: ${error}`);
      return {
        success: false,
        error,
        claimedUsd: 0,
        chain: bundle.chain
      };
    }

    logger.info(`Executing bundle ${bundle.id} with ${bundle.items.length} items worth $${bundle.totalUsd.toFixed(2)}`);
    
    const result = await client.sendRaw(bundle);
    
    if (result.success) {
      logger.bundleExecuted(bundle.id, true, result.txHash);
    } else {
      logger.bundleExecuted(bundle.id, false, undefined, result.error);
    }
    
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Execution error for bundle ${bundle.id}:`, errorMessage);
    
    return {
      success: false,
      error: `Execution error: ${errorMessage}`,
      claimedUsd: 0,
      chain: bundle.chain
    };
  }
}

export async function executeSequential(
  bundles: ClaimBundle[], 
  clients: Map<string, ChainClient>
): Promise<TxResult[]> {
  const results: TxResult[] = [];
  
  // Execute bundles sequentially to avoid nonce conflicts and better error handling
  for (const bundle of bundles) {
    const result = await execute(bundle, clients);
    results.push(result);
    
    // Add small delay between executions
    if (bundles.indexOf(bundle) < bundles.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}

export async function executeBatch(
  bundles: ClaimBundle[], 
  clients: Map<string, ChainClient>,
  batchSize: number = 3
): Promise<TxResult[]> {
  const results: TxResult[] = [];
  
  // Process bundles in batches to balance speed and reliability
  for (let i = 0; i < bundles.length; i += batchSize) {
    const batch = bundles.slice(i, i + batchSize);
    
    // Execute batch in parallel
    const batchPromises = batch.map(bundle => execute(bundle, clients));
    const batchResults = await Promise.allSettled(batchPromises);
    
    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j];
      const bundle = batch[j];
      
      if (!bundle) continue;
      
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        logger.error(`Execution promise rejected for bundle ${bundle.id}:`, result.reason);
        results.push({
          success: false,
          error: `Promise rejection: ${result.reason}`,
          claimedUsd: 0,
          chain: bundle.chain
        });
      }
    }
    
    // Add delay between batches
    if (i + batchSize < bundles.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  return results;
}

export function aggregateExecutionResults(results: TxResult[]): {
  successCount: number;
  failureCount: number;
  totalClaimedUsd: number;
  totalGasUsd: number;
  netUsd: number;
  successRate: number;
} {
  let successCount = 0;
  let failureCount = 0;
  let totalClaimedUsd = 0;
  let totalGasUsd = 0;
  
  for (const result of results) {
    if (result.success) {
      successCount++;
      totalClaimedUsd += result.claimedUsd;
      if (result.gasUsd) {
        totalGasUsd += result.gasUsd;
      }
    } else {
      failureCount++;
    }
  }
  
  const netUsd = totalClaimedUsd - totalGasUsd;
  const successRate = results.length > 0 ? successCount / results.length : 0;
  
  return {
    successCount,
    failureCount,
    totalClaimedUsd,
    totalGasUsd,
    netUsd,
    successRate
  };
}