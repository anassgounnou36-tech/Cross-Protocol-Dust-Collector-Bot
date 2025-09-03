export type Chain = 'avalanche' | 'tron';

export interface Address {
  readonly value: string;
  readonly chain: Chain;
}

export interface PendingReward {
  readonly id: string;
  readonly wallet: Address;
  readonly protocol: string;
  readonly token: Address;
  readonly amountWei: string;
  readonly amountUsd: number;
  readonly claimTo: Address;
  readonly lastClaimAt?: Date;
  readonly discoveredAt: Date;
  readonly estGasLimit?: number;
}

export interface ClaimBundle {
  readonly id: string;
  readonly chain: Chain;
  readonly protocol: string;
  readonly claimTo: Address;
  readonly items: PendingReward[];
  readonly totalUsd: number;
  readonly estGasUsd: number;
  readonly netUsd: number;
}

export interface TxResult {
  readonly success: boolean;
  readonly txHash?: string;
  readonly error?: string;
  readonly gasUsed?: string;
  readonly gasUsd?: number;
  readonly claimedUsd: number;
  readonly chain: Chain;
  readonly status?: string;
}

export interface Integration {
  readonly key: string;
  readonly chain: Chain;
  discoverWallets(): Promise<Address[]>;
  getPendingRewards(wallets: Address[]): Promise<PendingReward[]>;
  buildBundle(rewards: PendingReward[]): Promise<ClaimBundle[]>;
}

export interface SimulationResult {
  readonly ok: boolean;
  readonly reason?: string;
}

export interface ChainClient {
  readonly chain: Chain;
  gasPrice(): Promise<bigint>;
  nativeUsd(): Promise<number>;
  simulate(bundle: ClaimBundle): Promise<SimulationResult>;
  sendRaw(bundle: ClaimBundle): Promise<TxResult>;
}

export interface Config {
  readonly chains: {
    readonly avalanche: {
      readonly rpcUrl: string;
      readonly privateKey?: string;
    };
    readonly tron: {
      readonly rpcUrl: string;
      readonly privateKey?: string;
    };
  };
  readonly pricing: {
    readonly stableSymbols: string[];
    readonly tokenDecimals: Record<string, number>;
  };
  readonly policy: {
    readonly cooldownDays: number;
    readonly minItemUsd: number;
    readonly minBundleGrossUsd: number;
    readonly minBundleNetUsd: number;
    readonly maxBundleSize: number;
    readonly minBundleSize: number;
  };
  readonly database: {
    readonly path: string;
  };
  readonly mockMode: boolean;
}