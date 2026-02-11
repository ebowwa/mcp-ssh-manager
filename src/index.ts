#!/usr/bin/env node

/**
 * MCP SSH Manager
 * SSH Remote Server Management via Model Context Protocol
 *
 * TypeScript v2.0.0 - Full rewrite with bun/tsx
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { configLoader, type SSHServerConfig } from './config-loader.js';
import { SSHManager, createSSHManager } from './ssh-manager.js';
import { logger } from './logger.js';
import * as sshKeyManager from './ssh-key-manager.js';

// Active SSH sessions
const activeSessions = new Map<string, SSHManager>();

// Create MCP server
const server = new Server(
  {
    name: 'mcp-ssh-manager',
    version: '2.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // Core SSH operations
      {
        name: 'ssh_exec',
        description: 'Execute command on remote SSH server',
        inputSchema: {
          type: 'object',
          properties: {
            server: {
              type: 'string',
              description: 'Server name from config',
            },
            command: {
              type: 'string',
              description: 'Command to execute',
            },
            cwd: {
              type: 'string',
              description: 'Working directory (optional)',
            },
            timeout: {
              type: 'number',
              description: 'Timeout in milliseconds (default: 30000)',
            },
          },
          required: ['server', 'command'],
        },
      },
      {
        name: 'ssh_upload',
        description: 'Upload file to remote SSH server',
        inputSchema: {
          type: 'object',
          properties: {
            server: {
              type: 'string',
              description: 'Server name from config',
            },
            localPath: {
              type: 'string',
              description: 'Local file path',
            },
            remotePath: {
              type: 'string',
              description: 'Remote file path',
            },
          },
          required: ['server', 'localPath', 'remotePath'],
        },
      },
      {
        name: 'ssh_download',
        description: 'Download file from remote SSH server',
        inputSchema: {
          type: 'object',
          properties: {
            server: {
              type: 'string',
              description: 'Server name from config',
            },
            remotePath: {
              type: 'string',
              description: 'Remote file path',
            },
            localPath: {
              type: 'string',
              description: 'Local file path',
            },
          },
          required: ['server', 'remotePath', 'localPath'],
        },
      },
      {
        name: 'list_servers',
        description: 'List all configured SSH servers',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_server_info',
        description: 'Get detailed info about a specific server',
        inputSchema: {
          type: 'object',
          properties: {
            server: {
              type: 'string',
              description: 'Server name',
            },
          },
          required: ['server'],
        },
      },

      // SSH key management
      {
        name: 'ssh_key_list',
        description: 'List all known SSH hosts from known_hosts',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'ssh_key_remove',
        description: 'Remove host key from known_hosts',
        inputSchema: {
          type: 'object',
          properties: {
            host: {
              type: 'string',
              description: 'Host address',
            },
            port: {
              type: 'number',
              description: 'SSH port (default: 22)',
            },
          },
          required: ['host'],
        },
      },
      {
        name: 'ssh_key_add',
        description: 'Add host key to known_hosts',
        inputSchema: {
          type: 'object',
          properties: {
            host: {
              type: 'string',
              description: 'Host address',
            },
            port: {
              type: 'number',
              description: 'SSH port (default: 22)',
            },
          },
          required: ['host'],
        },
      },

      // Session management
      {
        name: 'session_create',
        description: 'Create persistent SSH session',
        inputSchema: {
          type: 'object',
          properties: {
            server: {
              type: 'string',
              description: 'Server name',
            },
            sessionName: {
              type: 'string',
              description: 'Optional session name',
            },
          },
          required: ['server'],
        },
      },
      {
        name: 'session_list',
        description: 'List active SSH sessions',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'session_close',
        description: 'Close SSH session',
        inputSchema: {
          type: 'object',
          properties: {
            sessionName: {
              type: 'string',
              description: 'Session name or "all"',
            },
          },
          required: ['sessionName'],
        },
      },

      // Health & monitoring
      {
        name: 'health_check',
        description: 'Check server health and status',
        inputSchema: {
          type: 'object',
          properties: {
            server: {
              type: 'string',
              description: 'Server name',
            },
          },
          required: ['server'],
        },
      },
      {
        name: 'get_home_dir',
        description: 'Get remote user home directory',
        inputSchema: {
          type: 'object',
          properties: {
            server: {
              type: 'string',
              description: 'Server name',
            },
          },
          required: ['server'],
        },
      },
    ],
  };
});

// Helper: Get or create SSH manager for a server
async function getSSHManager(serverName: string): Promise<SSHManager> {
  // Check for existing session
  const existingManager = activeSessions.get(serverName);
  if (existingManager && existingManager.isConnected()) {
    return existingManager;
  }

  // Create new connection
  return await createSSHManager(serverName);
}

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'ssh_exec': {
        const server = args?.server as string;
        const command = args?.command as string;
        const cwd = args?.cwd as string | undefined;
        const timeout = args?.timeout as number | undefined;

        const manager = await getSSHManager(server);
        const startTime = logger.logCommand(server, command, cwd);

        const result = await manager.execCommand(command, { cwd, timeout });

        logger.logCommandResult(server, command, startTime, result);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  server,
                  command,
                  cwd,
                  stdout: result.stdout,
                  stderr: result.stderr,
                  code: result.code,
                  signal: result.signal,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'ssh_upload': {
        const server = args?.server as string;
        const localPath = args?.localPath as string;
        const remotePath = args?.remotePath as string;

        const manager = await getSSHManager(server);
        await manager.uploadFile(localPath, remotePath);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, server, localPath, remotePath }, null, 2),
            },
          ],
        };
      }

      case 'ssh_download': {
        const server = args?.server as string;
        const remotePath = args?.remotePath as string;
        const localPath = args?.localPath as string;

        const manager = await getSSHManager(server);
        await manager.downloadFile(remotePath, localPath);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, server, remotePath, localPath }, null, 2),
            },
          ],
        };
      }

      case 'list_servers': {
        await configLoader.load();
        const servers = configLoader.getAllServers();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  servers: servers.map((s) => ({
                    name: s.name,
                    host: s.host,
                    user: s.user,
                    port: s.port || 22,
                    source: s.source,
                  })),
                  count: servers.length,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'get_server_info': {
        const server = args?.server as string;
        const config = configLoader.getServer(server);

        if (!config) {
          throw new Error(`Server not found: ${server}`);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(config, null, 2),
            },
          ],
        };
      }

      case 'ssh_key_list': {
        const hosts = sshKeyManager.listKnownHosts();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ hosts, count: hosts.length }, null, 2),
            },
          ],
        };
      }

      case 'ssh_key_remove': {
        const host = args?.host as string;
        const port = args?.port as number || 22;

        sshKeyManager.removeHostKey(host, port);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, host, port }, null, 2),
            },
          ],
        };
      }

      case 'ssh_key_add': {
        const host = args?.host as string;
        const port = args?.port as number || 22;

        await sshKeyManager.addHostKey(host, port);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, host, port }, null, 2),
            },
          ],
        };
      }

      case 'session_create': {
        const server = args?.server as string;
        const sessionName = args?.sessionName as string || server;

        const manager = await createSSHManager(server);
        activeSessions.set(sessionName, manager);

        const info = manager.getConnectionInfo();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  session: sessionName,
                  server,
                  ...info,
                  connected: true,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'session_list': {
        const sessions = Array.from(activeSessions.entries()).map(([name, manager]) => ({
          name,
          ...manager.getConnectionInfo(),
          connected: manager.isConnected(),
        }));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ sessions, count: sessions.length }, null, 2),
            },
          ],
        };
      }

      case 'session_close': {
        const sessionName = args?.sessionName as string;

        if (sessionName === 'all') {
          // Close all sessions
          for (const [name, manager] of activeSessions.entries()) {
            await manager.disconnect();
            activeSessions.delete(name);
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ success: true, closed: 'all' }, null, 2),
              },
            ],
          };
        }

        const manager = activeSessions.get(sessionName);
        if (!manager) {
          throw new Error(`Session not found: ${sessionName}`);
        }

        await manager.disconnect();
        activeSessions.delete(sessionName);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, closed: sessionName }, null, 2),
            },
          ],
        };
      }

      case 'health_check': {
        const server = args?.server as string;
        const config = configLoader.getServer(server);

        if (!config) {
          throw new Error(`Server not found: ${server}`);
        }

        const manager = await createSSHManager(server);

        // Basic health check
        const uptimeResult = await manager.execCommand('uptime', { timeout: 5000 });
        const diskResult = await manager.execCommand('df -h /', { timeout: 5000 });

        await manager.disconnect();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  server,
                  healthy: uptimeResult.code === 0,
                  uptime: uptimeResult.stdout.trim(),
                  disk: diskResult.stdout.trim(),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'get_home_dir': {
        const server = args?.server as string;
        const config = configLoader.getServer(server);

        if (!config) {
          throw new Error(`Server not found: ${server}`);
        }

        const manager = await createSSHManager(server);
        const homeDir = await manager.getHomeDir();

        await manager.disconnect();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ server, homeDir }, null, 2),
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: `Unknown tool: ${name}`,
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  // Load configuration
  await configLoader.load();

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP SSH Manager v2.0.0 running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
