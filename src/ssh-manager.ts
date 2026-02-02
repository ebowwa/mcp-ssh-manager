/**
 * SSH Manager - Core SSH connection and command execution
 */

import { Client, ConnectConfig, ClientChannel } from 'ssh2';
import fs from 'fs';
import os from 'os';
import { configLoader, type SSHServerConfig } from './config-loader.js';
import { logger } from './logger.js';
import * as sshKeyManager from './ssh-key-manager.js';

export interface SSHManagerConfig {
  host: string;
  user: string;
  password?: string;
  keyPath?: string;
  port?: number;
  autoAcceptHostKey?: boolean;
  hostKeyVerification?: boolean;
}

export interface ExecOptions {
  timeout?: number;
  cwd?: string;
  rawCommand?: boolean;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  code?: number;
  signal?: string;
}

export interface SFTPOptions {
  cwd?: string;
}

export class SSHManager {
  private config: SSHManagerConfig;
  private client: Client;
  private connected: boolean;
  private sftp: any | null;
  private cachedHomeDir: string | null;
  private autoAcceptHostKey: boolean;
  private hostKeyVerification: boolean;

  constructor(config: SSHManagerConfig) {
    this.config = config;
    this.client = new Client();
    this.connected = false;
    this.sftp = null;
    this.cachedHomeDir = null;
    this.autoAcceptHostKey = config.autoAcceptHostKey || false;
    this.hostKeyVerification = config.hostKeyVerification !== false;
  }

  /**
   * Connect to SSH server
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.on('ready', () => {
        this.connected = true;
        logger.logConnection(this.config.host, 'established');
        resolve();
      });

      this.client.on('error', (err: Error) => {
        this.connected = false;
        logger.logConnection(this.config.host, 'failed', { error: err.message });
        reject(err);
      });

      this.client.on('end', () => {
        this.connected = false;
        logger.logConnection(this.config.host, 'closed');
      });

      // Build connection config
      const connConfig: ConnectConfig = {
        host: this.config.host,
        port: this.config.port || 22,
        username: this.config.user,
        readyTimeout: 60000,
        keepaliveInterval: 10000,
        algorithms: {
          kex: [
            'ecdh-sha2-nistp256',
            'ecdh-sha2-nistp384',
            'ecdh-sha2-nistp521',
            'diffie-hellman-group-exchange-sha256',
            'diffie-hellman-group14-sha256',
            'diffie-hellman-group14-sha1',
          ],
          cipher: [
            'aes128-ctr',
            'aes192-ctr',
            'aes256-ctr',
            'aes128-gcm',
            'aes256-gcm',
            'aes128-cbc',
            'aes192-cbc',
            'aes256-cbc',
          ],
          serverHostKey: [
            'ssh-rsa',
            'ecdsa-sha2-nistp256',
            'ecdsa-sha2-nistp384',
            'ecdsa-sha2-nistp521',
            'ssh-ed25519',
          ],
          hmac: ['hmac-sha2-256', 'hmac-sha2-512', 'hmac-sha1'],
        },
        debug: (info: string) => {
          if (info.includes('Handshake') || info.includes('error')) {
            logger.debug('SSH2 Debug', { info });
          }
        },
      };

      // Add host key verification callback if enabled
      if (this.hostKeyVerification) {
        connConfig.hostVerifier = (hashedKey: string) => {
          const port = this.config.port || 22;
          const host = this.config.host;

          // Check if host is already known
          if (sshKeyManager.isHostKnown(host, port)) {
            logger.info('Host key verified', { host, port });
            return true;
          }

          // Host is not known
          logger.info('New host detected', { host, port });

          // If autoAcceptHostKey is enabled, accept and add the key
          if (this.autoAcceptHostKey) {
            logger.info('Auto-accept host key', { host, port });
            // Schedule key addition after connection
            void (async () => {
              try {
                await sshKeyManager.addHostKey(host, port);
                logger.info('Host key added', { host, port });
              } catch (err) {
                logger.warn('Failed to add host key', {
                  host,
                  port,
                  error: err instanceof Error ? err.message : String(err),
                });
              }
            })();
            return true;
          }

          // For backward compatibility, accept new hosts by default
          logger.warn('Auto-accepting new host', { host, port });
          return true;
        };
      }

      // Add authentication
      const keyPath = this.config.keyPath || (this.config as any).keypath;
      if (keyPath) {
        const resolvedKeyPath = keyPath.replace('~', os.homedir());
        connConfig.privateKey = fs.readFileSync(resolvedKeyPath);
      } else if (this.config.password) {
        connConfig.password = this.config.password;
      }

      this.client.connect(connConfig);
    });
  }

  /**
   * Disconnect from SSH server
   */
  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.connected) {
        resolve();
        return;
      }

      this.client.end();
      this.connected = false;
      resolve();
    });
  }

  /**
   * Execute a command on the remote server
   */
  async execCommand(command: string, options: ExecOptions = {}): Promise<ExecResult> {
    if (!this.connected) {
      throw new Error('Not connected to SSH server');
    }

    const { timeout = 30000, cwd, rawCommand = false } = options;
    const fullCommand = cwd && !rawCommand ? `cd ${cwd} && ${command}` : command;

    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let completed = false;
      let stream: ClientChannel | null = null;
      let timeoutId: NodeJS.Timeout | null = null;

      // Setup timeout
      if (timeout > 0) {
        timeoutId = setTimeout(() => {
          if (!completed) {
            completed = true;

            // Try multiple ways to kill the stream
            if (stream) {
              try {
                stream.write('\x03');
                stream.end();
                stream.destroy();
              } catch {
                // Ignore errors
              }
            }

            // Kill the entire client connection as last resort
            try {
              this.client.end();
              this.connected = false;
            } catch {
              // Ignore errors
            }

            reject(new Error(`Command timeout after ${timeout}ms: ${command.substring(0, 100)}...`));
          }
        }, timeout);
      }

      this.client.exec(fullCommand, (err, streamObj) => {
        if (err) {
          completed = true;
          if (timeoutId) clearTimeout(timeoutId);
          reject(err);
          return;
        }

        stream = streamObj;

        stream.on('close', (code: number, signal: string) => {
          if (!completed) {
            completed = true;
            if (timeoutId) clearTimeout(timeoutId);
            resolve({
              stdout,
              stderr,
              code,
              signal,
            });
          }
        });

        stream.on('data', (data: Buffer) => {
          stdout += data.toString();
        });

        stream.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });

        stream.on('error', (err: Error) => {
          if (!completed) {
            completed = true;
            if (timeoutId) clearTimeout(timeoutId);
            reject(err);
          }
        });
      });
    });
  }

  /**
   * Execute a command and return streaming output
   */
  async execCommandStream(command: string, options: ExecOptions = {}): Promise<AsyncIterable<string>> {
    if (!this.connected) {
      throw new Error('Not connected to SSH server');
    }

    const { cwd, rawCommand = false } = options;
    const fullCommand = cwd && !rawCommand ? `cd ${cwd} && ${command}` : command;

    return new Promise((resolve, reject) => {
      this.client.exec(fullCommand, (err, stream) => {
        if (err) {
          reject(err);
          return;
        }

        // Create async iterator for streaming
        const asyncIterator = (async function* () {
          let ended = false;

          stream.on('data', (data: Buffer) => {
            // This won't work directly, need proper async iterable
          });

          stream.on('close', () => {
            ended = true;
          });

          // For now, just return the full result
          try {
            const result = await new Promise<{ stdout: string; stderr: string }>((res, rej) => {
              let stdout = '';
              let stderr = '';

              stream.on('data', (data: Buffer) => {
                stdout += data.toString();
              });

              stream.stderr.on('data', (data: Buffer) => {
                stderr += data.toString();
              });

              stream.on('close', () => {
                res({ stdout, stderr });
              });

              stream.on('error', (err: Error) => {
                rej(err);
              });
            });

            yield result.stdout;
          } catch (error) {
            reject(error);
          }
        })();

        resolve(asyncIterator);
      });
    });
  }

  /**
   * Get SFTP client
   */
  async getSFTP(): Promise<any> {
    if (this.sftp) {
      return this.sftp;
    }

    return new Promise((resolve, reject) => {
      this.client.sftp((err, sftp) => {
        if (err) {
          reject(err);
          return;
        }

        this.sftp = sftp;
        resolve(sftp);
      });
    });
  }

  /**
   * Upload a file to the remote server
   */
  async uploadFile(localPath: string, remotePath: string): Promise<void> {
    const sftp = await this.getSFTP();

    return new Promise((resolve, reject) => {
      sftp.fastPut(localPath, remotePath, (err: Error | null) => {
        if (err) {
          logger.logTransfer('upload', this.config.host, localPath, remotePath, {
            success: false,
            error: err.message,
          });
          reject(err);
          return;
        }

        const stats = fs.statSync(localPath);
        logger.logTransfer('upload', this.config.host, localPath, remotePath, {
          success: true,
          size: stats.size,
        });
        resolve();
      });
    });
  }

  /**
   * Download a file from the remote server
   */
  async downloadFile(remotePath: string, localPath: string): Promise<void> {
    const sftp = await this.getSFTP();

    return new Promise((resolve, reject) => {
      sftp.fastGet(remotePath, localPath, (err: Error | null) => {
        if (err) {
          logger.logTransfer('download', this.config.host, remotePath, localPath, {
            success: false,
            error: err.message,
          });
          reject(err);
          return;
        }

        const stats = fs.statSync(localPath);
        logger.logTransfer('download', this.config.host, remotePath, localPath, {
          success: true,
          size: stats.size,
        });
        resolve();
      });
    });
  }

  /**
   * Get home directory of the remote user
   */
  async getHomeDir(): Promise<string> {
    if (this.cachedHomeDir) {
      return this.cachedHomeDir;
    }

    const result = await this.execCommand('echo $HOME');
    if (result.code !== 0) {
      throw new Error(`Failed to get home directory: ${result.stderr}`);
    }

    this.cachedHomeDir = result.stdout.trim();
    return this.cachedHomeDir;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get connection info
   */
  getConnectionInfo(): {
    host: string;
    port: number;
    user: string;
    connected: boolean;
  } {
    return {
      host: this.config.host,
      port: this.config.port || 22,
      user: this.config.user,
      connected: this.connected,
    };
  }
}

/**
 * Create SSH manager from server name
 */
export async function createSSHManager(serverName: string): Promise<SSHManager> {
  const config = configLoader.getServer(serverName);
  if (!config) {
    throw new Error(`Server not found: ${serverName}`);
  }

  const manager = new SSHManager({
    host: config.host,
    user: config.user || 'root',
    password: config.password,
    keyPath: config.keyPath,
    port: config.port || 22,
    autoAcceptHostKey: true,
    hostKeyVerification: true,
  });

  await manager.connect();
  return manager;
}

export default SSHManager;
