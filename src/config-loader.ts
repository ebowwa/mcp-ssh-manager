/**
 * Configuration Loader for MCP SSH Manager
 * Loads SSH server configurations from multiple sources
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { logger } from './logger.js';

export interface SSHServerConfig {
  name: string;
  host: string;
  user?: string;
  password?: string;
  keyPath?: string;
  port?: number;
  defaultDir?: string;
  sudoPassword?: string;
  description?: string;
  source?: string;
}

export interface ConfigOptions {
  envPath?: string;
  tomlPath?: string;
  preferToml?: boolean;
}

export interface SSHConfigFile {
  ssh_servers?: Record<string, {
    host: string;
    user?: string;
    password?: string;
    key_path?: string;
    keypath?: string;
    ssh_key?: string;
    port?: number;
    default_dir?: string;
    default_directory?: string;
    cwd?: string;
    sudo_password?: string;
    description?: string;
  }>;
}

interface ParsedEnv {
  [key: string]: string | undefined;
}

class ConfigLoader {
  private servers: Map<string, SSHServerConfig>;
  private configSource: string | null;

  constructor() {
    this.servers = new Map();
    this.configSource = null;
  }

  /**
   * Load configuration from multiple sources with priority:
   * 1. Environment variables (highest priority)
   * 2. .env file
   * 3. TOML config file (lowest priority)
   */
  async load(options: ConfigOptions = {}): Promise<Map<string, SSHServerConfig>> {
    const {
      envPath = path.join(process.cwd(), '.env'),
      tomlPath = process.env.SSH_CONFIG_PATH || path.join(os.homedir(), '.codex', 'ssh-config.toml'),
      preferToml = false,
    } = options;

    // Clear existing servers
    this.servers.clear();

    // Load in reverse priority order (lowest to highest)
    let loadedFromToml = false;
    let loadedFromEnv = false;

    // Try loading TOML config first (lowest priority)
    if (fs.existsSync(tomlPath)) {
      try {
        await this.loadTomlConfig(tomlPath);
        loadedFromToml = true;
        logger.info(`Loaded SSH configuration from TOML: ${tomlPath}`);
      } catch (error) {
        if (error instanceof Error) {
          logger.warn(`Failed to load TOML config: ${error.message}`);
        }
      }
    }

    // Load .env file (higher priority, overwrites TOML)
    if (!preferToml && fs.existsSync(envPath)) {
      try {
        this.loadEnvConfig(envPath);
        loadedFromEnv = true;
        logger.info(`Loaded SSH configuration from .env: ${envPath}`);
      } catch (error) {
        if (error instanceof Error) {
          logger.warn(`Failed to load .env config: ${error.message}`);
        }
      }
    }

    // Load from environment variables (highest priority, overwrites everything)
    this.loadEnvironmentVariables();

    // Determine primary config source
    if (loadedFromEnv) {
      this.configSource = 'env';
    } else if (loadedFromToml) {
      this.configSource = 'toml';
    } else if (this.servers.size > 0) {
      this.configSource = 'environment';
    } else {
      this.configSource = null;
      logger.warn('No SSH server configurations found');
    }

    return this.servers;
  }

  /**
   * Load configuration from TOML file
   */
  private async loadTomlConfig(tomlPath: string): Promise<void> {
    const content = fs.readFileSync(tomlPath, 'utf8');

    // Simple TOML parser for ssh_servers section
    const config = this.parseToml(content);

    if (config.ssh_servers) {
      for (const [name, serverConfig] of Object.entries(config.ssh_servers)) {
        const normalizedName = name.toLowerCase();
        this.servers.set(normalizedName, {
          name: normalizedName,
          host: serverConfig.host,
          user: serverConfig.user,
          password: serverConfig.password,
          keyPath: serverConfig.key_path || serverConfig.keypath || serverConfig.ssh_key,
          port: serverConfig.port || 22,
          defaultDir: serverConfig.default_dir || serverConfig.default_directory || serverConfig.cwd,
          sudoPassword: serverConfig.sudo_password,
          description: serverConfig.description,
          source: 'toml',
        });
      }
    }
  }

  /**
   * Simple TOML parser for our config format
   */
  private parseToml(content: string): SSHConfigFile {
    const config: SSHConfigFile = {};
    const lines = content.split('\n');
    const servers: Record<string, any> = {};
    let currentServer: any = null;
    let currentServerName: string | null = null;
    let inServersSection = false;

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      // Check for ssh_servers section
      if (trimmed === 'ssh_servers') {
        inServersSection = true;
        continue;
      }

      // Section start
      if (trimmed.startsWith('[')) {
        if (inServersSection && trimmed !== ']') {
          // Server subsection
          const match = trimmed.match(/\[ssh_servers\.([^\]]+)\]/);
          if (match) {
            currentServerName = match[1];
            currentServer = {};
            servers[currentServerName] = currentServer;
          }
        } else if (trimmed !== ']') {
          // Top-level section
          inServersSection = false;
          currentServer = null;
          currentServerName = null;
        }
        continue;
      }

      // Parse key = value pairs
      if (currentServer && currentServerName) {
        const equalIndex = trimmed.indexOf('=');
        if (equalIndex > 0) {
          const key = trimmed.slice(0, equalIndex).trim();
          let value: string | number = trimmed.slice(equalIndex + 1).trim();

          // Remove quotes if present
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
          } else if (value.startsWith("'") && value.endsWith("'")) {
            value = value.slice(1, -1);
          }

          // Convert port to number
          if (key === 'port' && typeof value === 'string') {
            const parsed = parseInt(value);
            if (!isNaN(parsed)) {
              value = parsed;
            }
          }

          (currentServer as any)[key] = value;
        }
      }
    }

    config.ssh_servers = servers;
    return config;
  }

  /**
   * Load configuration from .env file
   */
  private loadEnvConfig(envPath: string): void {
    // Parse .env file manually
    const envVars = this.parseEnvFile(envPath);
    this.parseEnvVariables(envVars);
  }

  /**
   * Parse .env file
   */
  private parseEnvFile(envPath: string): ParsedEnv {
    const content = fs.readFileSync(envPath, 'utf8');
    const envVars: ParsedEnv = {};

    for (const line of content.split('\n')) {
      const trimmed = line.trim();

      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      // Parse KEY=VALUE
      const equalIndex = trimmed.indexOf('=');
      if (equalIndex > 0) {
        const key = trimmed.slice(0, equalIndex).trim();
        let value = trimmed.slice(equalIndex + 1).trim();

        // Remove quotes if present
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
          value = value.slice(1, -1);
        }

        envVars[key] = value;
      }
    }

    return envVars;
  }

  /**
   * Load configuration from environment variables
   */
  private loadEnvironmentVariables(): void {
    this.parseEnvVariables(process.env);
  }

  /**
   * Parse environment variables for SSH server configurations
   */
  private parseEnvVariables(env: NodeJS.ProcessEnv | ParsedEnv): void {
    const serverPattern = /^SSH_SERVER_([A-Z0-9_]+)_HOST$/;
    const processedServers = new Set<string>();

    for (const [key, value] of Object.entries(env)) {
      const match = key.match(serverPattern);
      if (match && value) {
        const serverName = match[1].toLowerCase();

        // Skip if already processed from a higher priority source
        if (processedServers.has(serverName)) {
          continue;
        }

        const server: SSHServerConfig = {
          name: serverName,
          host: value,
          user: env[`SSH_SERVER_${match[1]}_USER`],
          password: env[`SSH_SERVER_${match[1]}_PASSWORD`],
          keyPath: env[`SSH_SERVER_${match[1]}_KEYPATH`],
          port: parseInt(env[`SSH_SERVER_${match[1]}_PORT`] || '22', 10),
          defaultDir: env[`SSH_SERVER_${match[1]}_DEFAULT_DIR`],
          sudoPassword: env[`SSH_SERVER_${match[1]}_SUDO_PASSWORD`],
          description: env[`SSH_SERVER_${match[1]}_DESCRIPTION`],
          source: 'env',
        };

        this.servers.set(serverName, server);
        processedServers.add(serverName);
      }
    }
  }

  /**
   * Get server configuration by name
   */
  getServer(name: string): SSHServerConfig | undefined {
    return this.servers.get(name.toLowerCase());
  }

  /**
   * Get all server configurations
   */
  getAllServers(): SSHServerConfig[] {
    return Array.from(this.servers.values());
  }

  /**
   * Check if server exists
   */
  hasServer(name: string): boolean {
    return this.servers.has(name.toLowerCase());
  }

  /**
   * Export current configuration to TOML format
   */
  exportToToml(): string {
    const servers: Record<string, any> = {};

    for (const [name, server] of this.servers) {
      servers[name] = {
        host: server.host,
        user: server.user,
        port: server.port || 22,
      };

      if (server.password) {
        servers[name].password = server.password;
      }
      if (server.keyPath) {
        servers[name].key_path = server.keyPath;
      }
      if (server.defaultDir) {
        servers[name].default_dir = server.defaultDir;
      }
      if (server.sudoPassword) {
        servers[name].sudo_password = server.sudoPassword;
      }
      if (server.description) {
        servers[name].description = server.description;
      }
    }

    let toml = 'ssh_servers\n';
    for (const [name, config] of Object.entries(servers)) {
      toml += `\n[ssh_servers.${name}]\n`;
      for (const [key, value] of Object.entries(config)) {
        toml += `  ${key} = "${value}"\n`;
      }
    }

    return toml;
  }

  /**
   * Export current configuration to .env format
   */
  exportToEnv(): string {
    const lines: string[] = [];

    lines.push('# SSH Server Configuration');
    lines.push('# Generated by MCP SSH Manager');
    lines.push('');

    for (const [name, server] of this.servers) {
      const upperName = name.toUpperCase();
      lines.push(`# Server: ${name}`);
      lines.push(`SSH_SERVER_${upperName}_HOST=${server.host}`);
      if (server.user) {
        lines.push(`SSH_SERVER_${upperName}_USER=${server.user}`);
      }
      if (server.password) {
        lines.push(`SSH_SERVER_${upperName}_PASSWORD="${server.password}"`);
      }
      if (server.keyPath) {
        lines.push(`SSH_SERVER_${upperName}_KEYPATH=${server.keyPath}`);
      }
      lines.push(`SSH_SERVER_${upperName}_PORT=${server.port || 22}`);
      if (server.defaultDir) {
        lines.push(`SSH_SERVER_${upperName}_DEFAULT_DIR=${server.defaultDir}`);
      }
      if (server.sudoPassword) {
        lines.push(`SSH_SERVER_${upperName}_SUDO_PASSWORD="${server.sudoPassword}"`);
      }
      if (server.description) {
        lines.push(`SSH_SERVER_${upperName}_DESCRIPTION="${server.description}"`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Save configuration to Codex TOML format
   */
  async saveToCodexConfig(codexConfigPath: string = path.join(os.homedir(), '.codex', 'config.toml')): Promise<void> {
    let config: any = {};

    // Load existing config if it exists
    if (fs.existsSync(codexConfigPath)) {
      const content = fs.readFileSync(codexConfigPath, 'utf8');
      config = this.parseToml(content);
    }

    // Add MCP server configuration
    if (!config.mcp_servers) {
      config.mcp_servers = {};
    }

    config.mcp_servers['ssh-manager'] = {
      command: 'node',
      args: [path.join(process.cwd(), 'dist', 'index.js')],
      env: {
        SSH_CONFIG_PATH: path.join(os.homedir(), '.codex', 'ssh-config.toml'),
      },
      startup_timeout_ms: 20000,
    };

    // Write back to config file
    const tomlContent = this.objectToToml(config);
    fs.writeFileSync(codexConfigPath, tomlContent, 'utf8');

    logger.info(`Updated Codex configuration at ${codexConfigPath}`);
  }

  /**
   * Convert object to TOML format
   */
  private objectToToml(obj: any, indent = 0): string {
    const spaces = '  '.repeat(indent);
    let toml = '';

    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) {
        continue;
      }

      if (typeof value === 'object' && !Array.isArray(value)) {
        toml += `${spaces}${key}\n`;
        toml += this.objectToToml(value, indent + 1);
      } else if (Array.isArray(value)) {
        toml += `${spaces}${key} = [\n`;
        for (const item of value) {
          if (typeof item === 'string') {
            toml += `${spaces}  "${item}",\n`;
          } else {
            toml += `${spaces}  ${JSON.stringify(item)},\n`;
          }
        }
        toml += `${spaces}]\n`;
      } else if (typeof value === 'string') {
        toml += `${spaces}${key} = "${value}"\n`;
      } else {
        toml += `${spaces}${key} = ${value}\n`;
      }
    }

    return toml;
  }

  /**
   * Migrate .env configuration to TOML
   */
  async migrateEnvToToml(envPath: string, tomlPath: string): Promise<number> {
    // Load from .env
    this.servers.clear();
    this.loadEnvConfig(envPath);

    // Export to TOML
    const tomlContent = this.exportToToml();

    // Ensure directory exists
    const tomlDir = path.dirname(tomlPath);
    if (!fs.existsSync(tomlDir)) {
      fs.mkdirSync(tomlDir, { recursive: true });
    }

    // Write TOML file
    fs.writeFileSync(tomlPath, tomlContent, 'utf8');

    logger.info(`Migrated ${this.servers.size} servers from ${envPath} to ${tomlPath}`);
    return this.servers.size;
  }
}

// Export singleton instance
export const configLoader = new ConfigLoader();

export default configLoader;
