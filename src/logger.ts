/**
 * Logger module for MCP SSH Manager
 * Provides structured logging with levels and optional verbose mode
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Log levels
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export const LOG_LEVELS = LogLevel;

// Colors for terminal output
const COLORS = {
  [LogLevel.DEBUG]: '\x1b[36m', // Cyan
  [LogLevel.INFO]: '\x1b[32m',  // Green
  [LogLevel.WARN]: '\x1b[33m',  // Yellow
  [LogLevel.ERROR]: '\x1b[31m', // Red
  RESET: '\x1b[0m',
} as const;

// Icons for each level
const ICONS = {
  [LogLevel.DEBUG]: '🔍',
  [LogLevel.INFO]: '✅',
  [LogLevel.WARN]: '⚠️',
  [LogLevel.ERROR]: '❌',
} as const;

interface LogEntry {
  timestamp: string;
  server: string;
  command: string;
  success: boolean;
  duration: string;
  error?: string;
}

interface CommandResult {
  code?: number;
  stderr?: string;
  stdout?: string;
}

interface TransferResult {
  success: boolean;
  size?: number;
  duration?: number;
  error?: string;
}

interface LogData {
  server?: string;
  command?: string;
  cwd?: string;
  [key: string]: unknown;
}

type LogLevelName = keyof typeof LogLevel;

class Logger {
  private currentLevel: LogLevel;
  private verbose: boolean;
  private logFile: string;
  private historyFile: string;
  private commandHistory: LogEntry[];

  constructor() {
    // Set log level from environment variable
    const envLevel = (process.env.SSH_LOG_LEVEL?.toUpperCase() || 'INFO') as LogLevelName;
    this.currentLevel = LogLevel[envLevel] ?? LogLevel.INFO;

    // Enable verbose mode from environment
    this.verbose = process.env.SSH_VERBOSE === 'true';

    // Log file path
    this.logFile = process.env.SSH_LOG_FILE || path.join(__dirname, '..', '.ssh-manager.log');

    // Command history file
    this.historyFile = path.join(__dirname, '..', '.ssh-command-history.json');

    // Initialize command history
    this.commandHistory = this.loadCommandHistory();
  }

  /**
   * Load command history from file
   */
  private loadCommandHistory(): LogEntry[] {
    try {
      if (fs.existsSync(this.historyFile)) {
        const data = fs.readFileSync(this.historyFile, 'utf8');
        return JSON.parse(data) as LogEntry[];
      }
    } catch {
      // Ignore errors, start with empty history
    }
    return [];
  }

  /**
   * Save command to history
   */
  private saveCommandToHistory(command: string, server: string, result: { success: boolean; duration: string; error?: string }): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      server,
      command,
      success: result.success,
      duration: result.duration,
      error: result.error,
    };

    this.commandHistory.push(entry);

    // Keep only last 1000 commands
    if (this.commandHistory.length > 1000) {
      this.commandHistory = this.commandHistory.slice(-1000);
    }

    try {
      fs.writeFileSync(this.historyFile, JSON.stringify(this.commandHistory, null, 2));
    } catch {
      // Ignore write errors
    }
  }

  /**
   * Format log message with timestamp and level
   */
  private formatMessage(level: LogLevel, message: string, data: LogData = {}): { console: string; file: string } {
    const timestamp = new Date().toISOString();
    const levelName = Object.keys(LogLevel).find(key => LogLevel[key as LogLevelName] === level) as LogLevelName || 'INFO';

    // Console format with colors
    const consoleFormat = `${COLORS[level]}${ICONS[level]} [${timestamp}] [${levelName}]${COLORS.RESET} ${message}`;

    // File format without colors
    const fileFormat = `[${timestamp}] [${levelName}] ${message}`;

    // Add data if present
    let dataStr = '';
    if (Object.keys(data).length > 0) {
      dataStr = '\n  ' + JSON.stringify(data, null, 2).replace(/\n/g, '\n  ');
    }

    return {
      console: consoleFormat + (this.verbose && dataStr ? dataStr : ''),
      file: fileFormat + dataStr,
    };
  }

  /**
   * Main log function
   */
  private log(level: LogLevel, message: string, data: LogData = {}): void {
    // Check if we should log this level
    if (level < this.currentLevel) {
      return;
    }

    const formatted = this.formatMessage(level, message, data);

    // Output to stderr for proper MCP logging
    console.error(formatted.console);

    // Also write to file
    try {
      fs.appendFileSync(this.logFile, formatted.file + '\n');
    } catch {
      // Ignore file write errors
    }
  }

  // Convenience methods
  debug(message: string, data?: LogData): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: LogData): void {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: LogData): void {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, data?: LogData): void {
    this.log(LogLevel.ERROR, message, data);
  }

  /**
   * Log SSH command execution
   */
  logCommand(server: string, command: string, cwd?: string): number {
    const logData: LogData = {
      server,
      command: this.verbose ? command : command.substring(0, 100) + (command.length > 100 ? '...' : ''),
      cwd,
    };

    if (this.verbose) {
      this.debug('Executing SSH command', logData);
    } else {
      this.info(`SSH execute on ${server}`, { command: logData.command });
    }

    return Date.now(); // Return start time for duration calculation
  }

  /**
   * Log SSH command result
   */
  logCommandResult(server: string, command: string, startTime: number, result: CommandResult): void {
    const duration = Date.now() - startTime;

    const resultData = {
      success: !result.code,
      duration: `${duration}ms`,
      error: result.code ? result.stderr : undefined,
    };

    // Save to history
    this.saveCommandToHistory(command, server, {
      success: !result.code,
      duration: `${duration}ms`,
      error: result.stderr,
    });

    if (result.code) {
      this.error(`Command failed on ${server}`, resultData);
    } else if (this.verbose) {
      this.debug(`Command completed on ${server}`, resultData);
    }
  }

  /**
   * Log SSH connection events
   */
  logConnection(server: string, event: string, data: LogData = {}): void {
    const message = `SSH connection ${event}: ${server}`;

    switch (event) {
      case 'established':
        this.info(message, data);
        break;
      case 'reused':
        this.debug(message, data);
        break;
      case 'closed':
        this.info(message, data);
        break;
      case 'failed':
        this.error(message, data);
        break;
      default:
        this.debug(message, data);
    }
  }

  /**
   * Log file transfer operations
   */
  logTransfer(operation: string, server: string, source: string, destination: string, result?: TransferResult): void {
    const data: LogData = { server, source, destination };

    if (result) {
      data.success = result.success;
      data.size = result.size;
      data.duration = result.duration;
    }

    const message = `File ${operation} ${result ? (result.success ? 'completed' : 'failed') : 'started'}`;

    if (result && !result.success) {
      this.error(message, data);
    } else {
      this.info(message, data);
    }
  }

  /**
   * Get command history
   */
  getHistory(limit: number = 100): LogEntry[] {
    return this.commandHistory.slice(-limit);
  }

  /**
   * Clear logs and history
   */
  clear(): void {
    this.commandHistory = [];
    try {
      fs.writeFileSync(this.historyFile, '[]');
      fs.writeFileSync(this.logFile, '');
      this.info('Logs and history cleared');
    } catch (error) {
      this.error('Failed to clear logs', { error: error instanceof Error ? error.message : String(error) });
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Export for convenience
export const { debug, info, warn, error } = logger;

export default logger;
