/**
 * Production-ready logging utility
 * In production, logs are suppressed or sent to monitoring service
 * In development, logs are shown in console
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private isDevelopment = import.meta.env.DEV;

  private shouldLog(level: LogLevel): boolean {
    if (this.isDevelopment) return true;
    
    // In production, only log warnings and errors
    return level === 'warn' || level === 'error';
  }

  private formatMessage(level: LogLevel, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      // eslint-disable-next-line no-console
      console.debug(this.formatMessage('debug', message), ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      // eslint-disable-next-line no-console
      console.info(this.formatMessage('info', message), ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      // eslint-disable-next-line no-console
      console.warn(this.formatMessage('warn', message), ...args);
      
      // In production, send to monitoring service
      if (!this.isDevelopment) {
        // TODO: Send to monitoring service (e.g., Sentry, LogRocket)
        // this.sendToMonitoring('warn', message, args);
      }
    }
  }

  error(message: string, error?: Error | unknown, ...args: any[]): void {
    if (this.shouldLog('error')) {
      // eslint-disable-next-line no-console
      console.error(this.formatMessage('error', message), error, ...args);
      
      // In production, always send errors to monitoring service
      if (!this.isDevelopment) {
        // TODO: Send to error tracking service
        // this.sendToMonitoring('error', message, { error, args });
      }
    }
  }
}

export const logger = new Logger();

