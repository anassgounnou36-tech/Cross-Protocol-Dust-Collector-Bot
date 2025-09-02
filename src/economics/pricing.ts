import type { Chain, Config } from '../types/common.js';

// Token decimals mapping for common tokens
const TOKEN_DECIMALS: Record<string, number> = {
  'USDT': 6,
  'USDC': 6, 
  'DAI': 18,
  'AVAX': 18,
  'TRX': 6,
  'WETH': 18,
  'WBTC': 8,
  'JOE': 18,
  'QI': 18,
  'GMX': 18
};

export function getTokenDecimals(symbol: string): number {
  return TOKEN_DECIMALS[symbol.toUpperCase()] || 18;
}

export function isStablecoin(symbol: string, config: Config): boolean {
  return config.pricing.stableSymbols.includes(symbol.toUpperCase());
}

export async function quoteToUsd(
  chain: Chain, 
  tokenAddress: string, 
  amountWei: string,
  config: Config
): Promise<number> {
  try {
    // Extract token symbol from address (this is a simplified approach)
    // TODO: Implement proper token symbol resolution via contract calls
    const tokenSymbol = getTokenSymbolFromAddress(tokenAddress);
    
    if (isStablecoin(tokenSymbol, config)) {
      // For stablecoins, assume 1:1 USD parity
      const decimals = getTokenDecimals(tokenSymbol);
      const amount = parseFloat(amountWei) / Math.pow(10, decimals);
      return amount;
    }

    // TODO: Implement real price fetching from:
    // - DEX routers (Trader Joe, PancakeSwap, etc.)
    // - Price oracles (Chainlink, etc.)
    // - External APIs (CoinGecko, DeFiLlama, etc.)
    
    console.warn(`quoteToUsd: Real pricing not implemented for ${tokenSymbol} on ${chain}. Returning 0.`);
    return 0;
  } catch (error) {
    console.error(`Failed to quote ${tokenAddress} to USD:`, error);
    return 0;
  }
}

// Helper function to extract token symbol from address
// This is a simplified implementation - in reality, you'd need to:
// 1. Call the token contract's symbol() function
// 2. Maintain a database of known token addresses
// 3. Use third-party APIs for token metadata
function getTokenSymbolFromAddress(address: string): string {
  // Simple mapping for common addresses - this would need to be expanded
  const knownTokens: Record<string, string> = {
    // Avalanche C-Chain
    '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E': 'USDC',
    '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7': 'USDT',
    '0xd586E7F844cEa2F87f50152665BCbc2C279D8d70': 'DAI',
    '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7': 'WAVAX',
    
    // Tron (TRC-20)
    'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t': 'USDT', // USDT-TRC20
    'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8': 'USDC', // USDC-TRC20
  };

  return knownTokens[address] || 'UNKNOWN';
}

export function formatTokenAmount(amountWei: string, decimals: number): string {
  const amount = parseFloat(amountWei) / Math.pow(10, decimals);
  return amount.toFixed(6);
}

export function parseTokenAmount(amount: string, decimals: number): string {
  const parsed = parseFloat(amount) * Math.pow(10, decimals);
  return Math.floor(parsed).toString();
}