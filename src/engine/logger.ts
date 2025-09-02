export class Logger {
  private logLevel: string;

  constructor(logLevel: string = 'info') {
    this.logLevel = logLevel;
  }

  private getTimestamp(): string {
    return new Date().toISOString();
  }

  private shouldLog(level: string): boolean {
    const levels = ['error', 'warn', 'info', 'debug'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const requestedLevelIndex = levels.indexOf(level);
    return requestedLevelIndex <= currentLevelIndex;
  }

  private formatMessage(level: string, message: string, ...args: any[]): string {
    const timestamp = this.getTimestamp();
    const formattedArgs = args.length > 0 ? ' ' + args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ') : '';
    
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${formattedArgs}`;
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, ...args));
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, ...args));
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message, ...args));
    }
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message, ...args));
    }
  }

  // Specialized logging methods for bot operations
  bundleCreated(bundleId: string, itemCount: number, totalUsd: number): void {
    this.info(`Bundle created: ${bundleId} with ${itemCount} items worth $${totalUsd.toFixed(2)}`);
  }

  bundleExecuted(bundleId: string, success: boolean, txHash?: string, error?: string): void {
    if (success && txHash) {
      this.info(`Bundle executed successfully: ${bundleId} (tx: ${txHash})`);
    } else {
      this.error(`Bundle execution failed: ${bundleId}`, error);
    }
  }

  discoveryRun(protocol: string, walletCount: number, rewardCount: number): void {
    this.info(`Discovery completed: ${protocol} found ${rewardCount} rewards across ${walletCount} wallets`);
  }

  profitabilityCheck(bundleId: string, passed: boolean, reason?: string): void {
    if (passed) {
      this.debug(`Profitability check passed: ${bundleId}`);
    } else {
      this.debug(`Profitability check failed: ${bundleId} - ${reason}`);
    }
  }
}

// Global logger instance
export const logger = new Logger(process.env.LOG_LEVEL || 'info');