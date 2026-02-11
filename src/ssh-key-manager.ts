/**
 * SSH Key Manager - Manage SSH host keys and known_hosts
 */

import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { logger } from './logger.js';

// Path to known_hosts file
const KNOWN_HOSTS_PATH = path.join(process.env.HOME || os.homedir(), '.ssh', 'known_hosts');
const KNOWN_HOSTS_BACKUP = path.join(process.env.HOME || os.homedir(), '.ssh', 'known_hosts.mcp-backup');

interface KnownHostEntry {
  host: string;
  keyType: string;
  key: string;
  comment: string;
}

interface HostFingerprint {
  host: string;
  type: string;
  fingerprint: string;
  fullKey: string;
}

interface HostKeyVerificationResult {
  changed: boolean;
  reason: string;
  currentFingerprints?: string[];
  newFingerprints?: string[];
  error?: string;
}

interface HostInfo {
  host: string;
  port: number;
}

interface SSHKeyErrorHandlingOptions {
  autoAccept?: boolean;
  interactive?: boolean;
}

interface SSHKeyErrorResult {
  action: string;
  host?: string;
  port?: number;
  message?: string;
}

/**
 * Parse a known_hosts entry
 */
function parseKnownHostEntry(line: string): KnownHostEntry | null {
  if (!line || line.startsWith('#')) return null;

  const parts = line.split(' ');
  if (parts.length < 3) return null;

  return {
    host: parts[0],
    keyType: parts[1],
    key: parts[2],
    comment: parts.slice(3).join(' ') || '',
  };
}

/**
 * Get the SSH host key fingerprint for a server
 */
export async function getHostKeyFingerprint(host: string, port: number = 22): Promise<HostFingerprint[]> {
  return new Promise((resolve, reject) => {
    const cmd = spawn('ssh-keyscan', ['-p', port.toString(), '-t', 'ed25519,rsa,ecdsa', host]);
    let stdout = '';
    let stderr = '';

    cmd.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    cmd.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    cmd.on('close', (code: number) => {
      if (code !== 0) {
        reject(new Error(`Failed to get host key: ${stderr}`));
        return;
      }

      const lines = stdout.trim().split('\n').filter((l) => l && !l.startsWith('#'));
      const fingerprints: HostFingerprint[] = [];

      for (const line of lines) {
        const entry = parseKnownHostEntry(line);
        if (entry) {
          // Calculate SHA256 fingerprint
          const keyData = Buffer.from(entry.key, 'base64');
          const hash = crypto.createHash('sha256').update(keyData).digest('base64');

          fingerprints.push({
            host: entry.host,
            type: entry.keyType,
            fingerprint: `SHA256:${hash}`,
            fullKey: line,
          });
        }
      }

      resolve(fingerprints);
    });
  });
}

/**
 * Check if a host key exists in known_hosts
 */
export function isHostKnown(host: string, port: number = 22): boolean {
  if (!fs.existsSync(KNOWN_HOSTS_PATH)) {
    return false;
  }

  const content = fs.readFileSync(KNOWN_HOSTS_PATH, 'utf8');
  const lines = content.split('\n');

  // Format host entry as SSH does
  const hostEntry = port === 22 ? host : `[${host}]:${port}`;

  for (const line of lines) {
    if (line.includes(hostEntry)) {
      return true;
    }
  }

  return false;
}

/**
 * Get current host key from known_hosts
 */
export function getCurrentHostKey(host: string, port: number = 22): HostFingerprint[] | null {
  if (!fs.existsSync(KNOWN_HOSTS_PATH)) {
    return null;
  }

  const content = fs.readFileSync(KNOWN_HOSTS_PATH, 'utf8');
  const lines = content.split('\n');

  // Format host entry as SSH does
  const hostEntry = port === 22 ? host : `[${host}]:${port}`;
  const keys: HostFingerprint[] = [];

  for (const line of lines) {
    if (line.includes(hostEntry)) {
      const entry = parseKnownHostEntry(line);
      if (entry) {
        const keyData = Buffer.from(entry.key, 'base64');
        const hash = crypto.createHash('sha256').update(keyData).digest('base64');

        keys.push({
          host: entry.host,
          type: entry.keyType,
          fingerprint: `SHA256:${hash}`,
          fullKey: line,
        });
      }
    }
  }

  return keys.length > 0 ? keys : null;
}

/**
 * Remove a host from known_hosts
 */
export function removeHostKey(host: string, port: number = 22): boolean {
  try {
    const hostEntry = port === 22 ? host : `[${host}]:${port}`;

    // Use ssh-keygen to remove the host
    execSync(`ssh-keygen -R "${hostEntry}"`, { stdio: 'ignore' });

    logger.info('Host key removed', { host, port });
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to remove host key', { host, port, error: errorMessage });
    throw new Error(`Failed to remove host key: ${errorMessage}`);
  }
}

/**
 * Add a host key to known_hosts
 */
export async function addHostKey(host: string, port: number = 22, keyData: string | null = null): Promise<boolean> {
  try {
    // Backup current known_hosts
    if (fs.existsSync(KNOWN_HOSTS_PATH)) {
      fs.copyFileSync(KNOWN_HOSTS_PATH, KNOWN_HOSTS_BACKUP);
    }

    // If no key data provided, fetch it
    if (!keyData) {
      const fingerprints = await getHostKeyFingerprint(host, port);
      if (fingerprints.length === 0) {
        throw new Error('No host keys found');
      }
      keyData = fingerprints.map((fp) => fp.fullKey).join('\n');
    }

    // Ensure .ssh directory exists
    const sshDir = path.dirname(KNOWN_HOSTS_PATH);
    if (!fs.existsSync(sshDir)) {
      fs.mkdirSync(sshDir, { mode: 0o700, recursive: true });
    }

    // Append to known_hosts
    fs.appendFileSync(KNOWN_HOSTS_PATH, keyData + '\n');

    logger.info('Host key added', { host, port });
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to add host key', { host, port, error: errorMessage });
    throw new Error(`Failed to add host key: ${errorMessage}`);
  }
}

/**
 * Update a host key (remove old, add new)
 */
export async function updateHostKey(host: string, port: number = 22): Promise<boolean> {
  try {
    // Remove old key
    removeHostKey(host, port);

    // Add new key
    await addHostKey(host, port);

    logger.info('Host key updated', { host, port });
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to update host key', { host, port, error: errorMessage });
    throw new Error(`Failed to update host key: ${errorMessage}`);
  }
}

/**
 * Verify if host key has changed
 */
export async function hasHostKeyChanged(host: string, port: number = 22): Promise<HostKeyVerificationResult> {
  try {
    const currentKeys = getCurrentHostKey(host, port);
    if (!currentKeys || currentKeys.length === 0) {
      // No key in known_hosts
      return { changed: false, reason: 'not_in_known_hosts' };
    }

    const newKeys = await getHostKeyFingerprint(host, port);
    if (!newKeys || newKeys.length === 0) {
      return { changed: false, reason: 'cannot_fetch_key' };
    }

    // Check if any current key matches any new key
    for (const currentKey of currentKeys) {
      for (const newKey of newKeys) {
        if (currentKey.fingerprint === newKey.fingerprint) {
          return { changed: false, reason: 'key_matches' };
        }
      }
    }

    // Keys don't match
    return {
      changed: true,
      reason: 'key_mismatch',
      currentFingerprints: currentKeys.map((k) => k.fingerprint),
      newFingerprints: newKeys.map((k) => k.fingerprint),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to verify host key', { host, port, error: errorMessage });
    return {
      changed: false,
      reason: 'verification_error',
      error: errorMessage,
    };
  }
}

interface KnownHostInfo {
  host: string;
  port: number;
  keys: Array<{
    type: string;
    fingerprint: string;
  }>;
}

/**
 * List all known hosts
 */
export function listKnownHosts(): KnownHostInfo[] {
  if (!fs.existsSync(KNOWN_HOSTS_PATH)) {
    return [];
  }

  const content = fs.readFileSync(KNOWN_HOSTS_PATH, 'utf8');
  const lines = content.split('\n');
  const hosts = new Map<string, KnownHostInfo>();

  for (const line of lines) {
    if (line && !line.startsWith('#')) {
      const entry = parseKnownHostEntry(line);
      if (entry) {
        // Extract host and port
        let host = entry.host;
        let port = 22;

        if (host.startsWith('[')) {
          const match = host.match(/\[([^\]]+)\]:(\d+)/);
          if (match) {
            host = match[1];
            port = parseInt(match[2]);
          }
        }

        const keyData = Buffer.from(entry.key, 'base64');
        const hash = crypto.createHash('sha256').update(keyData).digest('base64');

        const hostKey = `${host}:${port}`;
        if (!hosts.has(hostKey)) {
          hosts.set(hostKey, {
            host,
            port,
            keys: [],
          });
        }

        hosts.get(hostKey)!.keys.push({
          type: entry.keyType,
          fingerprint: `SHA256:${hash}`,
        });
      }
    }
  }

  return Array.from(hosts.values());
}

/**
 * Detect SSH key error in command output
 */
export function detectSSHKeyError(stderr: string): boolean {
  const keyErrorPatterns = [
    'WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED',
    'Host key verification failed',
    'The authenticity of host',
    'ECDSA host key for .* has changed',
    'RSA host key for .* has changed',
    'ED25519 host key for .* has changed',
    'Offending key in',
    'Add correct host key in',
  ];

  for (const pattern of keyErrorPatterns) {
    const regex = new RegExp(pattern, 'i');
    if (regex.test(stderr)) {
      return true;
    }
  }

  return false;
}

/**
 * Extract host info from SSH error
 */
export function extractHostFromSSHError(stderr: string): HostInfo | null {
  // Try to extract host and port from error message
  const patterns = [
    /Offending (?:RSA|ECDSA|ED25519) key in .+:(\d+)/i,
    /Host key for \[([^\]]+)\]:(\d+) has changed/i,
    /Host key for ([^\s]+) has changed/i,
    /The authenticity of host '\[([^\]]+)\]:(\d+)'/i,
    /The authenticity of host '([^\s]+) \(/i,
  ];

  for (const pattern of patterns) {
    const match = stderr.match(pattern);
    if (match) {
      if (match[2]) {
        // Host and port
        return { host: match[1], port: parseInt(match[2]) };
      } else {
        // Just host
        return { host: match[1], port: 22 };
      }
    }
  }

  return null;
}

/**
 * Handle SSH key error automatically
 */
export async function handleSSHKeyError(
  stderr: string,
  options: SSHKeyErrorHandlingOptions = {}
): Promise<SSHKeyErrorResult> {
  const { autoAccept = false, interactive = true } = options;

  const hostInfo = extractHostFromSSHError(stderr);
  if (!hostInfo) {
    throw new Error('Could not extract host information from SSH error');
  }

  logger.warn('SSH host key verification failed', hostInfo as unknown as Record<string, unknown>);

  if (autoAccept) {
    // Automatically update the key
    await updateHostKey(hostInfo.host, hostInfo.port);
    return { action: 'updated', ...hostInfo };
  }

  if (!interactive) {
    throw new Error(
      `Host key verification failed for ${hostInfo.host}:${hostInfo.port}. Use ssh_key_manage tool to update the key.`
    );
  }

  // In interactive mode, we would prompt the user
  // For now, just return the error info
  return {
    action: 'prompt_required',
    ...hostInfo,
    message: `Host key has changed for ${hostInfo.host}:${hostInfo.port}. Use ssh_key_manage tool to verify and update the key.`,
  };
}

export default {
  getHostKeyFingerprint,
  isHostKnown,
  getCurrentHostKey,
  removeHostKey,
  addHostKey,
  updateHostKey,
  hasHostKeyChanged,
  listKnownHosts,
  detectSSHKeyError,
  extractHostFromSSHError,
  handleSSHKeyError,
};
