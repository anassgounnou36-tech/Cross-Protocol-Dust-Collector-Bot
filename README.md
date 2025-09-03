# Cross-Protocol Dust Collector Bot

A modular TypeScript bot that automatically discovers wallets with unclaimed protocol rewards on Tron and Avalanche C-Chain, analyzes profitability, and executes profitable claims while minimizing gas costs.

## Overview

The Cross-Protocol Dust Collector Bot helps users recover forgotten or unclaimed rewards from various DeFi protocols. It intelligently bundles multiple claims together to optimize gas efficiency and only executes trades that meet minimum profitability thresholds.

## Features

- **Multi-Chain Support**: Tron and Avalanche C-Chain
- **Protocol Integration**: JustLend, SunSwap, GMX, Trader Joe, BENQI, Yield Yak
- **Intelligent Bundling**: Groups claims by protocol and destination to minimize gas costs
- **Profitability Analysis**: Only executes profitable claims after gas cost estimation
- **Risk Management**: Quarantine system for problematic wallets, retry mechanisms
- **Comprehensive Logging**: Detailed execution logs and performance metrics
- **Mock Mode**: Safe testing without real transactions

## Implemented (Phase 1)

✅ **Avalanche Chain Client**: Complete implementation with Chainlink price feeds and EIP-1559 support
- `gasPrice()`: Returns maxFeePerGas with fallback to gasPrice
- `nativeUsd()`: Chainlink AVAX/USD feed integration with fallback pricing  
- `simulate()`: Transaction simulation with revert reason extraction
- `sendRaw()`: Full transaction building and execution with gas cost calculation
- Exported standalone functions for library-style usage

✅ **Pricing Engine Skeleton**: Stable token support with 30-second in-memory cache
- Support for USDC, USDT, DAI stable token pricing
- `quoteToUsd()`: Returns USD value for stable tokens, placeholder for non-stable
- Configurable token decimals mapping
- Cache implementation with TTL for performance

✅ **Gas Estimator**: Dynamic gas estimation using live chain data
- `estimateBundleUsd()`: Estimates gas costs using current chain prices
- Integration with Avalanche client `gasPrice()` and `nativeUsd()`
- Default gas limits with override support
- Sets `estGasUsd` on bundle objects

✅ **Enhanced Types**: Extended interfaces for new functionality
- `TxResult` includes chain field and status
- `PendingReward` supports optional `estGasLimit`
- Full backward compatibility maintained

⏳ **Coming Next (Phase 2)**:
- Tron chain client implementation
- Router-based pricing (Trader Joe integration)
- Advanced gas optimization strategies
- Idempotency improvements

## Architecture

```
src/
├── chains/          # Blockchain adapters (Avalanche, Tron)
├── integrations/    # Protocol-specific reward detection
├── discovery/       # Wallet discovery mechanisms
├── economics/       # Pricing, gas estimation, profitability rules
├── engine/          # Core execution engine (bundler, simulator, executor)
├── state/           # SQLite database management
├── types/           # TypeScript interfaces
├── config/          # Configuration management
└── cli/             # Command-line tools
```

## Profitability Rules

- **Cooldown Period**: Skip wallets claimed within 7 days
- **Minimum Reward**: Individual rewards must be ≥ $0.10 USD
- **Bundle Size**: 10-30 claims per bundle
- **Minimum Gross**: Bundle total must be ≥ $2.00 USD
- **Minimum Net**: Bundle profit after gas must be ≥ $1.00 USD
- **Gas Efficiency**: Automatic gas estimation and optimization

## Directory Structure

```
Cross-Protocol-Dust-Collector-Bot/
├── src/
│   ├── chains/           # Blockchain client adapters
│   ├── integrations/     # Protocol-specific modules
│   ├── discovery/        # Wallet discovery algorithms
│   ├── economics/        # Financial analysis modules
│   ├── engine/           # Core execution engine
│   ├── state/            # Database management
│   ├── types/            # TypeScript definitions
│   ├── config/           # Configuration files
│   └── cli/              # Command-line interfaces
├── tests/                # Test suites
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── README.md             # This file
├── LICENSE              # MIT License
└── .env.example         # Environment template
```

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Private keys for blockchain interactions
PRIVATE_KEY_AVAX=your_avalanche_private_key_here
PRIVATE_KEY_TRON=your_tron_private_key_here
PRIVATE_KEY=your_avalanche_private_key_here

# RPC endpoints
PRICER_RPC_AVAX=https://api.avax.network/ext/bc/C/rpc
PRICER_RPC_TRON=https://api.trongrid.io
AVALANCHE_RPC_URL=https://api.avax.network/ext/bc/C/rpc

# Chainlink price feeds
CHAINLINK_AVAX_USD_FEED=0x0A77230d17318075983913bC2145DB16C7366156

# Bot configuration
MOCK_MODE=true
LOG_LEVEL=info
DB_PATH=./bot.db
```

### Configuration File

Edit `src/config/config.example.json` for:
- Token decimal mappings
- Stablecoin definitions
- Profitability thresholds
- Bundle size limits

## Running

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm run build
npm start
```

### Available Commands
```bash
npm run dev        # Development mode with hot reload
npm run build      # Compile TypeScript
npm start          # Run compiled bot
npm test           # Run test suite
npm run backfill   # Discover and store rewards (no execution)
npm run report     # Generate execution report
```

## Mock Mode

For safe testing without real transactions:

1. Set `MOCK_MODE=true` in `.env`
2. Run without providing private keys
3. Bot will simulate discoveries and executions
4. Creates realistic test data in database

Example mock execution:
```bash
MOCK_MODE=true npm run dev
```

The bot will:
- Discover sample wallets
- Find mock JustLend rewards (~$2.50 USDT)
- Create profitable bundles
- Simulate successful executions
- Record results in database

## Roadmap

### Critical TODOs for Production:

1. **Real Protocol Integration**
   - [ ] Implement actual contract ABIs and addresses
   - [ ] Add real reward detection logic for each protocol
   - [ ] Integrate with protocol subgraphs

2. **Pricing Infrastructure**
   - [ ] Connect to DEX routers for real-time pricing
   - [ ] Integrate with price oracles (Chainlink, etc.)
   - [ ] Add external APIs (CoinGecko, DeFiLlama)

3. **Gas Optimization**
   - [ ] Implement multicall transaction bundling
   - [ ] Add dynamic gas price optimization
   - [ ] Improve gas estimation accuracy

4. **Discovery Enhancement**
   - [ ] Real wallet discovery heuristics
   - [ ] On-chain event scanning
   - [ ] Cross-chain address correlation

5. **Production Readiness**
   - [ ] Error classification and metrics
   - [ ] Persistent idempotency store
   - [ ] Performance monitoring
   - [ ] Health checks and alerting

6. **Security & Compliance**
   - [ ] Formal security audit
   - [ ] Rate limiting and API protection
   - [ ] Compliance checking

## Security Notes

⚠️ **Important Security Considerations:**

- **Never commit private keys** to version control
- **Use environment variables** for sensitive configuration
- **Test thoroughly** in mock mode before live deployment
- **Monitor gas costs** to prevent excessive spending
- **Review all transactions** before signing
- **Keep private keys secure** and use hardware wallets when possible

## Development

### Prerequisites
- Node.js 20+
- npm or yarn

### Setup
```bash
git clone <repository>
cd Cross-Protocol-Dust-Collector-Bot
npm install
cp .env.example .env
# Edit .env with your configuration
npm run dev
```

### Testing
```bash
npm test              # Run all tests
npm run test:unit     # Unit tests only
npm run test:integration  # Integration tests only
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## Support

For issues and questions:
- Open an issue on GitHub
- Check existing documentation
- Review the mock mode for understanding bot behavior
