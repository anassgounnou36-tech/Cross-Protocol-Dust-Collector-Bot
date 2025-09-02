import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { Address, PendingReward, ClaimBundle, TxResult } from '../types/common.js';

export interface WalletRecord {
  id: number;
  address: string;
  chain: string;
  first_seen_at: string;
  last_claim_at?: string;
  total_claimed_usd: number;
}

export interface PendingRewardRecord {
  id: string;
  wallet_address: string;
  wallet_chain: string;
  protocol: string;
  token_address: string;
  token_chain: string;
  amount_wei: string;
  amount_usd: number;
  claim_to_address: string;
  claim_to_chain: string;
  discovered_at: string;
  last_claim_at?: string;
  is_stale: boolean;
}

export interface ExecutionRecord {
  id: string;
  bundle_id: string;
  chain: string;
  protocol: string;
  claim_to_address: string;
  claim_to_chain: string;
  total_usd: number;
  est_gas_usd: number;
  net_usd: number;
  item_count: number;
  success: boolean;
  tx_hash?: string;
  error_message?: string;
  gas_used?: string;
  actual_gas_usd?: number;
  actual_claimed_usd?: number;
  executed_at: string;
}

let dbInstance: Database.Database | null = null;

export function initDb(dbPath: string): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = new Database(dbPath);
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('synchronous = NORMAL');
  
  return dbInstance;
}

export function initSchema(db: Database.Database): void {
  const schemaPath = join(__dirname, 'schema.sql');
  try {
    const schema = readFileSync(schemaPath, 'utf-8');
    db.exec(schema);
  } catch (error) {
    // If we can't find the schema file, create tables manually
    db.exec(`
      CREATE TABLE IF NOT EXISTS wallets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        address TEXT NOT NULL,
        chain TEXT NOT NULL,
        first_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_claim_at DATETIME,
        total_claimed_usd REAL DEFAULT 0,
        UNIQUE(address, chain)
      );

      CREATE TABLE IF NOT EXISTS pending_rewards (
        id TEXT PRIMARY KEY,
        wallet_address TEXT NOT NULL,
        wallet_chain TEXT NOT NULL,
        protocol TEXT NOT NULL,
        token_address TEXT NOT NULL,
        token_chain TEXT NOT NULL,
        amount_wei TEXT NOT NULL,
        amount_usd REAL NOT NULL,
        claim_to_address TEXT NOT NULL,
        claim_to_chain TEXT NOT NULL,
        discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_claim_at DATETIME,
        is_stale BOOLEAN DEFAULT FALSE
      );

      CREATE TABLE IF NOT EXISTS executions (
        id TEXT PRIMARY KEY,
        bundle_id TEXT NOT NULL,
        chain TEXT NOT NULL,
        protocol TEXT NOT NULL,
        claim_to_address TEXT NOT NULL,
        claim_to_chain TEXT NOT NULL,
        total_usd REAL NOT NULL,
        est_gas_usd REAL NOT NULL,
        net_usd REAL NOT NULL,
        item_count INTEGER NOT NULL,
        success BOOLEAN NOT NULL,
        tx_hash TEXT,
        error_message TEXT,
        gas_used TEXT,
        actual_gas_usd REAL,
        actual_claimed_usd REAL,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }
}

export function getDb(): Database.Database {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return dbInstance;
}

export function upsertWallet(db: Database.Database, wallet: Address): void {
  const stmt = db.prepare(`
    INSERT INTO wallets (address, chain) 
    VALUES (?, ?)
    ON CONFLICT(address, chain) DO NOTHING
  `);
  stmt.run(wallet.value, wallet.chain);
}

export function recordPending(db: Database.Database, reward: PendingReward): void {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO pending_rewards (
      id, wallet_address, wallet_chain, protocol, token_address, token_chain,
      amount_wei, amount_usd, claim_to_address, claim_to_chain, discovered_at, last_claim_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    reward.id,
    reward.wallet.value,
    reward.wallet.chain,
    reward.protocol,
    reward.token.value,
    reward.token.chain,
    reward.amountWei,
    reward.amountUsd,
    reward.claimTo.value,
    reward.claimTo.chain,
    reward.discoveredAt.toISOString(),
    reward.lastClaimAt?.toISOString() || null
  );
}

export function recordExecution(
  db: Database.Database, 
  bundle: ClaimBundle, 
  result: TxResult
): void {
  const stmt = db.prepare(`
    INSERT INTO executions (
      id, bundle_id, chain, protocol, claim_to_address, claim_to_chain,
      total_usd, est_gas_usd, net_usd, item_count, success, tx_hash,
      error_message, gas_used, actual_gas_usd, actual_claimed_usd
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    bundle.id,
    bundle.id, // bundle_id same as id for now
    bundle.chain,
    bundle.protocol,
    bundle.claimTo.value,
    bundle.claimTo.chain,
    bundle.totalUsd,
    bundle.estGasUsd,
    bundle.netUsd,
    bundle.items.length,
    result.success,
    result.txHash || null,
    result.error || null,
    result.gasUsed || null,
    result.gasUsd || null,
    result.claimedUsd
  );
}

export function markClaimed(
  db: Database.Database, 
  rewardIds: string[], 
  claimedAt: Date = new Date()
): void {
  const stmt = db.prepare(`
    UPDATE pending_rewards 
    SET is_stale = TRUE, last_claim_at = ?
    WHERE id = ?
  `);

  const transaction = db.transaction((ids: string[]) => {
    for (const id of ids) {
      stmt.run(claimedAt.toISOString(), id);
    }
  });

  transaction(rewardIds);
}

export function getWalletLastClaim(db: Database.Database, wallet: Address): Date | null {
  const stmt = db.prepare(`
    SELECT last_claim_at FROM wallets 
    WHERE address = ? AND chain = ?
  `);
  
  const result = stmt.get(wallet.value, wallet.chain) as WalletRecord | undefined;
  return result?.last_claim_at ? new Date(result.last_claim_at) : null;
}

export function getRecentExecutions(db: Database.Database, hoursBack: number = 24): ExecutionRecord[] {
  const stmt = db.prepare(`
    SELECT * FROM executions 
    WHERE executed_at > datetime('now', '-${hoursBack} hours')
    ORDER BY executed_at DESC
  `);
  
  return stmt.all() as ExecutionRecord[];
}