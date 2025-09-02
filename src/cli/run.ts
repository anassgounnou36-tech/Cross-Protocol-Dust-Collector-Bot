#!/usr/bin/env node

import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { Config, Integration, ChainClient } from '../types/common.js';
import { initDb, initSchema, upsertWallet, recordPending } from '../state/db.js';
import { AvalancheClient } from '../chains/avalanche.js';
import { TronClient } from '../chains/tron.js';
import { justlendIntegration } from '../integrations/justlend.js';
import { sunswapIntegration } from '../integrations/sunswap.js';
import { gmxIntegration } from '../integrations/gmx.js';
import { traderJoeIntegration } from '../integrations/traderjoe.js';
import { benqiIntegration } from '../integrations/benqi.js';
import { yieldYakIntegration } from '../integrations/yieldyak.js';
import { seedWallets } from '../discovery/seeds.js';
import { groupByContract, splitLargeBundles, mergeBundles } from '../engine/bundler.js';
import { dryRun } from '../engine/simulator.js';
import { execute } from '../engine/executor.js';
import { recordExecutionResult } from '../engine/ledger.js';
import { shouldSkipIdempotency } from '../engine/idempotency.js';
import { isWalletQuarantined, withExponentialBackoff } from '../engine/retry.js';
import { Scheduler } from '../engine/scheduler.js';
import { logger } from '../engine/logger.js';
import { Policy } from '../economics/policy.js';

// Load environment variables
config();

function loadConfig(): Config {
  try {
    const configPath = join(__dirname, '../config/config.example.json');
    const configFile = readFileSync(configPath, 'utf-8');
    const baseConfig = JSON.parse(configFile);
    
    // Override with environment variables
    const envConfig: Config = {
      ...baseConfig,
      chains: {
        avalanche: {
          rpcUrl: process.env.PRICER_RPC_AVAX || baseConfig.chains.avalanche.rpcUrl,
          privateKey: process.env.PRIVATE_KEY_AVAX
        },
        tron: {
          rpcUrl: process.env.PRICER_RPC_TRON || baseConfig.chains.tron.rpcUrl,
          privateKey: process.env.PRIVATE_KEY_TRON
        }
      },
      database: {
        path: process.env.DB_PATH || baseConfig.database.path
      },
      mockMode: process.env.MOCK_MODE === 'true'
    };
    
    return envConfig;
  } catch (error) {
    logger.error('Failed to load configuration:', error);
    process.exit(1);
  }
}

function createChainClients(config: Config): Map<string, ChainClient> {
  const clients = new Map<string, ChainClient>();
  
  // Create Avalanche client if key is provided or in mock mode
  if (config.chains.avalanche.privateKey || config.mockMode) {
    const avalancheClient = new AvalancheClient(
      config.chains.avalanche.rpcUrl,
      config.chains.avalanche.privateKey
    );
    clients.set('avalanche', avalancheClient);
    logger.info('Avalanche client initialized');
  }
  
  // Create Tron client if key is provided or in mock mode
  if (config.chains.tron.privateKey || config.mockMode) {
    const tronClient = new TronClient(
      config.chains.tron.rpcUrl,
      config.chains.tron.privateKey
    );
    clients.set('tron', tronClient);
    logger.info('Tron client initialized');
  }
  
  return clients;
}

function getActiveIntegrations(config: Config): Integration[] {
  const integrations: Integration[] = [];
  
  // Add integrations based on available clients
  if (config.chains.tron.privateKey || config.mockMode) {
    integrations.push(justlendIntegration);
    integrations.push(sunswapIntegration);
  }
  
  if (config.chains.avalanche.privateKey || config.mockMode) {
    integrations.push(gmxIntegration);
    integrations.push(traderJoeIntegration);
    integrations.push(benqiIntegration);
    integrations.push(yieldYakIntegration);
  }
  
  return integrations;
}

async function runDiscoveryAndClaims(
  config: Config,
  clients: Map<string, ChainClient>,
  integrations: Integration[]
): Promise<void> {
  const db = initDb(config.database.path);
  
  logger.info('Starting discovery and claims cycle...');
  
  try {
    // Get seed wallets
    const seeds = await seedWallets();
    logger.info(`Found ${seeds.length} seed wallets`);
    
    // Upsert seed wallets into database
    for (const wallet of seeds) {
      upsertWallet(db, wallet);
    }
    
    // Run integrations to discover pending rewards
    const allPendingRewards = [];
    
    for (const integration of integrations) {
      try {
        logger.info(`Running integration: ${integration.key}`);
        
        // Discover wallets for this integration
        const wallets = await integration.discoverWallets();
        logger.discoveryRun(integration.key, wallets.length, 0);
        
        if (wallets.length === 0) {
          continue;
        }
        
        // Filter out quarantined wallets
        const activeWallets = wallets.filter(wallet => !isWalletQuarantined(wallet));
        if (activeWallets.length < wallets.length) {
          logger.info(`Filtered out ${wallets.length - activeWallets.length} quarantined wallets`);
        }
        
        // Get pending rewards
        const pendingRewards = await integration.getPendingRewards(activeWallets);
        logger.discoveryRun(integration.key, activeWallets.length, pendingRewards.length);
        
        // Store pending rewards in database
        for (const reward of pendingRewards) {
          recordPending(db, reward);
        }
        
        allPendingRewards.push(...pendingRewards);
      } catch (error) {
        logger.error(`Integration ${integration.key} failed:`, error);
      }
    }
    
    if (allPendingRewards.length === 0) {
      logger.info('No pending rewards found');
      return;
    }
    
    // Filter rewards by policy
    const filteredRewards = allPendingRewards.filter(reward => {
      // Filter out micro-dust
      if (reward.amountUsd < Policy.MIN_ITEM_USD) {
        return false;
      }
      
      // Check cooldown period
      if (reward.lastClaimAt) {
        const daysSinceClaim = (Date.now() - reward.lastClaimAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceClaim < Policy.COOLDOWN_DAYS) {
          return false;
        }
      }
      
      return true;
    });
    
    logger.info(`Filtered ${allPendingRewards.length} rewards to ${filteredRewards.length} after policy checks`);
    
    if (filteredRewards.length === 0) {
      return;
    }
    
    // Create bundles
    let bundles = groupByContract(filteredRewards);
    logger.info(`Created ${bundles.length} initial bundles`);
    
    // Apply bundle size constraints
    bundles = splitLargeBundles(bundles, Policy.MAX_BUNDLE_SIZE);
    bundles = mergeBundles(bundles, Policy.MIN_BUNDLE_SIZE);
    
    // Filter bundles by profitability
    const profitableBundles = bundles.filter(bundle => {
      if (bundle.totalUsd < Policy.MIN_BUNDLE_GROSS_USD) {
        logger.profitabilityCheck(bundle.id, false, `Gross USD ${bundle.totalUsd} < ${Policy.MIN_BUNDLE_GROSS_USD}`);
        return false;
      }
      
      if (bundle.netUsd < Policy.MIN_BUNDLE_NET_USD) {
        logger.profitabilityCheck(bundle.id, false, `Net USD ${bundle.netUsd} < ${Policy.MIN_BUNDLE_NET_USD}`);
        return false;
      }
      
      logger.profitabilityCheck(bundle.id, true);
      return true;
    });
    
    logger.info(`${profitableBundles.length} of ${bundles.length} bundles passed profitability checks`);
    
    // Execute profitable bundles
    for (const bundle of profitableBundles) {
      try {
        // Check idempotency
        if (shouldSkipIdempotency(bundle)) {
          logger.info(`Skipping bundle ${bundle.id} due to idempotency`);
          continue;
        }
        
        // Simulate execution
        const simulationResult = await dryRun(bundle, clients);
        if (!simulationResult.ok) {
          logger.warn(`Simulation failed for bundle ${bundle.id}: ${simulationResult.reason}`);
          continue;
        }
        
        // Execute with retry
        const result = await withExponentialBackoff(
          () => execute(bundle, clients),
          Policy.RETRY_MAX_ATTEMPTS,
          Policy.RETRY_BASE_DELAY_MS,
          `bundle-${bundle.id}`
        );
        
        // Record execution result
        recordExecutionResult(db, bundle, result);
        
        if (result.success) {
          logger.info(`Successfully executed bundle ${bundle.id}: claimed $${result.claimedUsd.toFixed(2)}`);
        } else {
          logger.error(`Bundle execution failed ${bundle.id}: ${result.error}`);
        }
        
      } catch (error) {
        logger.error(`Failed to execute bundle ${bundle.id}:`, error);
      }
    }
    
  } catch (error) {
    logger.error('Discovery and claims cycle failed:', error);
  }
}

async function main(): Promise<void> {
  logger.info('Cross-Protocol Dust Collector Bot starting...');
  
  const config = loadConfig();
  logger.info(`Configuration loaded, mock mode: ${config.mockMode}`);
  
  // Initialize database
  const db = initDb(config.database.path);
  initSchema(db);
  logger.info('Database initialized');
  
  // Create chain clients
  const clients = createChainClients(config);
  logger.info(`Initialized ${clients.size} chain clients`);
  
  // Get active integrations
  const integrations = getActiveIntegrations(config);
  logger.info(`Active integrations: ${integrations.map(i => i.key).join(', ')}`);
  
  if (integrations.length === 0) {
    logger.error('No integrations available. Please provide private keys or enable mock mode.');
    process.exit(1);
  }
  
  // Start scheduler
  const scheduler = new Scheduler({
    intervalMs: Policy.SCHEDULE_TICK_INTERVAL_MS,
    jitterMs: Policy.SCHEDULE_JITTER_MS
  });
  
  await scheduler.loop(async () => {
    await runDiscoveryAndClaims(config, clients, integrations);
  });
  
  logger.info('Bot shutdown complete');
}

// Run the bot
if (require.main === module) {
  main().catch((error) => {
    logger.error('Fatal error:', error);
    process.exit(1);
  });
}