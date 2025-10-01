# MCP SSH Manager 🚀

A powerful Model Context Protocol (MCP) server that enables **Claude Code** and **OpenAI Codex** to manage multiple SSH connections seamlessly. Control remote servers, execute commands, and transfer files directly from your AI assistant.

<div align="center">

[![Claude Code](https://img.shields.io/badge/Claude_Code-Compatible-5A67D8?style=for-the-badge&logo=anthropic)](https://claude.ai/code)
[![OpenAI Codex](https://img.shields.io/badge/OpenAI_Codex-Compatible-00A67E?style=for-the-badge&logo=openai)](https://openai.com/codex)
[![MCP](https://img.shields.io/badge/MCP-Server-orange?style=for-the-badge)](https://modelcontextprotocol.io)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

<a href="https://glama.ai/mcp/servers/@bvisible/mcp-ssh-manager">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@bvisible/mcp-ssh-manager/badge" alt="SSH Manager MCP server" />
</a>

</div>

---

## 📑 Table of Contents

- [Features](#-features)
- [Quick Start - Claude Code](#-quick-start---claude-code)
- [Quick Start - OpenAI Codex](#-quick-start---openai-codex)
- [Prerequisites](#-prerequisites)
- [Available MCP Tools](#-available-mcp-tools)
- [Configuration](#-configuration)
- [Usage Examples](#-usage-examples)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🌟 Features

### Core Features
- **🔗 Multiple SSH Connections** - Manage unlimited SSH servers from a single interface
- **🔐 Secure Authentication** - Support for both password and SSH key authentication
- **📁 File Operations** - Upload and download files between local and remote systems
- **⚡ Command Execution** - Run commands on remote servers with working directory support
- **📂 Default Directories** - Set default working directories per server for convenience
- **🎯 Easy Configuration** - Simple `.env` file setup with guided configuration tool

### New v2.0 Features 🆕
- **🚀 Bash CLI** - Lightning-fast pure Bash CLI for server management
- **📊 Advanced Logging** - Comprehensive logging system with levels and history
- **🔄 Rsync Integration** - Bidirectional file sync with rsync support
- **💻 Persistent Sessions** - Maintain shell context across multiple commands
- **👥 Server Groups** - Execute commands on multiple servers simultaneously
- **🔧 SSH Tunnels** - Local/remote port forwarding and SOCKS proxy support
- **📈 System Monitoring** - Real-time monitoring of CPU, memory, disk, and network
- **🏷️ Server Aliases** - Use short aliases instead of full server names
- **🚀 Smart Deployment** - Automated file deployment with permission handling
- **🔑 Sudo Support** - Execute commands with sudo privileges securely
- **📝 OpenAI Codex Support** - Compatible with OpenAI Codex via TOML configuration

## 📋 Prerequisites

- Node.js (v18 or higher)
- npm (comes with Node.js)
- **For Claude Code**: Claude Code CLI installed
- **For OpenAI Codex**: Codex CLI configured
- Bash 4.0+ (for CLI management tools)
- rsync (for file synchronization)
- sshpass (optional, for rsync with password authentication)
  - macOS: `brew install hudochenkov/sshpass/sshpass`
  - Linux: `apt-get install sshpass`

## 🚀 Quick Start - Claude Code

### 1. Install MCP SSH Manager

```bash
# Clone and install
git clone https://github.com/bvisible/mcp-ssh-manager.git
cd mcp-ssh-manager
npm install

# Install the Bash CLI
cd cli && ./install.sh

# Configure your first server
ssh-manager server add
```

### 2. Install to Claude Code

```bash
# For personal use (current user only)
claude mcp add ssh-manager node /path/to/mcp-ssh-manager/src/index.js

# For team sharing (creates .mcp.json in project)
claude mcp add ssh-manager --scope project node /path/to/mcp-ssh-manager/src/index.js

# For all your projects
claude mcp add ssh-manager --scope user node /path/to/mcp-ssh-manager/src/index.js
```

### 3. Configure Auto-Approval (Optional but Recommended)

To avoid being prompted for approval on every SSH command, add auto-approve configuration:

Edit `~/.config/claude-code/claude_code_config.json`:

```json
{
  "mcpServers": {
    "ssh-manager": {
      "command": "node",
      "args": ["/path/to/mcp-ssh-manager/src/index.js"],
      "autoApprove": [
        "mcp__ssh-manager__ssh_execute",
        "mcp__ssh-manager__ssh_list_servers",
        "mcp__ssh-manager__ssh_upload",
        "mcp__ssh-manager__ssh_download",
        "mcp__ssh-manager__ssh_sync",
        "mcp__ssh-manager__ssh_alias"
      ]
    }
  }
}
```

**Important**: Restart Claude Code after making this change.

For full auto-approval of all SSH tools, see the complete list in [examples/claude-code-config.example.json](examples/claude-code-config.example.json).

### 4. Start Using!

In Claude Code, you can now:

```
"List all my SSH servers"
"Execute 'ls -la' on production server"  # Uses default directory if set
"Run 'docker ps' on staging"
"Upload config.json to production:/etc/app/config.json"
"Download logs from staging:/var/log/app.log"
```

**With Default Directories:**
If you set `/var/www/html` as default for production, these commands are equivalent:
- `"Run 'ls' on production"` → executes in `/var/www/html`
- `"Run 'ls' on production in /tmp"` → executes in `/tmp` (overrides default)

---

## 🚀 Quick Start - OpenAI Codex

### 1. Install MCP SSH Manager

Same installation as Claude Code (see above), then configure for Codex:

```bash
# Set up Codex integration
ssh-manager codex setup

# Migrate existing servers to TOML format (if you have .env servers)
ssh-manager codex migrate

# Test the integration
ssh-manager codex test
```

### 2. Manual Configuration (Optional)

If you prefer manual setup, add to `~/.codex/config.toml`:

```toml
[mcp_servers.ssh-manager]
command = "node"
args = ["/absolute/path/to/mcp-ssh-manager/src/index.js"]
env = { SSH_CONFIG_PATH = "/Users/you/.codex/ssh-config.toml" }
startup_timeout_ms = 20000
```

### 3. Configure Servers in TOML Format

Create or edit `~/.codex/ssh-config.toml`:

```toml
[ssh_servers.production]
host = "prod.example.com"
user = "admin"
password = "secure_password"  # or use key_path
key_path = "~/.ssh/id_rsa"   # for SSH key auth (recommended)
port = 22
default_dir = "/var/www"
description = "Production server"

[ssh_servers.staging]
host = "staging.example.com"
user = "deploy"
key_path = "~/.ssh/staging_key"
port = 2222
default_dir = "/home/deploy/app"
```

💡 **See [examples/codex-ssh-config.example.toml](examples/codex-ssh-config.example.toml) for more complete examples!**

### 4. Start Using in Codex!

In OpenAI Codex, you can now:

```
"List my SSH servers"
"Execute 'docker ps' on production"
"Upload file.txt to staging:/tmp/"
"Monitor CPU usage on all servers"
"Download production:/var/log/app.log to ./logs/"
```

### Converting Between Formats

Switch easily between Claude Code (.env) and Codex (TOML):

```bash
# Convert .env to TOML (for Codex)
ssh-manager codex convert to-toml

# Convert TOML back to .env (for Claude Code)
ssh-manager codex convert to-env
```

Both formats can coexist! The system supports both simultaneously.

---

## 🛠️ Available MCP Tools

### Core Tools

#### `ssh_list_servers`
Lists all configured SSH servers with their details.

#### `ssh_execute`
Execute commands on remote servers.
- Parameters: `server` (name), `command`, `cwd` (optional working directory)
- **Note**: If no `cwd` is provided, uses the server's default directory if configured

#### `ssh_upload`
Upload files to remote servers.
- Parameters: `server`, `local_path`, `remote_path`

#### `ssh_download`
Download files from remote servers.
- Parameters: `server`, `remote_path`, `local_path`

### Backup & Restore Tools (v2.1+) 🔄

#### `ssh_backup_create`
Create backup of database or files on remote server.
- Types: MySQL, PostgreSQL, MongoDB, Files
- Parameters: `server`, `type`, `name`, `database`, `paths`, `retention`
- Automatic compression and metadata tracking
- See [Backup Guide](docs/BACKUP_GUIDE.md) for detailed usage

#### `ssh_backup_list`
List all available backups on remote server.
- Parameters: `server`, `type` (optional filter)
- Returns backup details with size, date, and retention info

#### `ssh_backup_restore`
Restore from a previous backup.
- Parameters: `server`, `backupId`, `database`, `targetPath`
- Supports cross-database restoration

#### `ssh_backup_schedule`
Schedule automatic backups using cron.
- Parameters: `server`, `schedule` (cron format), `type`, `name`
- Automatic cleanup based on retention policy

### Deployment Tools (v1.2+)

#### `ssh_deploy` 🚀
Deploy files with automatic permission and backup handling.
- Parameters: `server`, `files` (array), `options` (owner, permissions, backup, restart)
- Automatically handles permission issues and creates backups

#### `ssh_execute_sudo` 🔐
Execute commands with sudo privileges.
- Parameters: `server`, `command`, `password` (optional), `cwd` (optional)
- Securely handles sudo password without exposing in logs

### Server Management

#### `ssh_alias` 🏷️
Manage server aliases for easier access.
- Parameters: `action` (add/remove/list), `alias`, `server`
- Example: Create alias "prod" for "production" server

#### `ssh_command_alias` 📝
Manage command aliases for frequently used commands.
- Parameters: `action` (add/remove/list/suggest), `alias`, `command`
- Aliases loaded from active profile
- Example: Custom aliases for your project

#### `ssh_hooks` 🎣
Manage automation hooks for SSH operations.
- Parameters: `action` (list/enable/disable/status), `hook`
- Hooks loaded from active profile
- Example: Project-specific validation and automation

#### `ssh_profile` 📚
Manage configuration profiles for different project types.
- Parameters: `action` (list/switch/current), `profile`
- Available profiles: default, frappe, docker, nodejs
- Example: Switch between different project configurations

## 🔧 Configuration

### Profiles

SSH Manager uses profiles to configure aliases and hooks for different project types:

1. **Set active profile**: 
   - Environment variable: `export SSH_MANAGER_PROFILE=frappe`
   - Configuration file: Create `.ssh-manager-profile` with profile name
   - Default: Uses `default` profile if not specified

2. **Available profiles**:
   - `default` - Basic SSH operations
   - `frappe` - Frappe/ERPNext specific
   - `docker` - Docker container management
   - `nodejs` - Node.js applications
   - Create custom profiles in `profiles/` directory

### Environment Variables

Servers are configured in the `.env` file with this pattern:

```env
# Server configuration pattern
SSH_SERVER_[NAME]_HOST=hostname_or_ip
SSH_SERVER_[NAME]_USER=username
SSH_SERVER_[NAME]_PASSWORD=password  # For password auth
SSH_SERVER_[NAME]_KEYPATH=~/.ssh/key  # For SSH key auth
SSH_SERVER_[NAME]_PORT=22  # Optional, defaults to 22
SSH_SERVER_[NAME]_DEFAULT_DIR=/path/to/dir  # Optional, default working directory
SSH_SERVER_[NAME]_DESCRIPTION=Description  # Optional

# Example
SSH_SERVER_PRODUCTION_HOST=prod.example.com
SSH_SERVER_PRODUCTION_USER=admin
SSH_SERVER_PRODUCTION_PASSWORD=secure_password
SSH_SERVER_PRODUCTION_PORT=22
SSH_SERVER_PRODUCTION_DEFAULT_DIR=/var/www/html
SSH_SERVER_PRODUCTION_DESCRIPTION=Production Server
SSH_SERVER_PRODUCTION_SUDO_PASSWORD=secure_sudo_pass  # Optional, for automated deployments
```

### Server Management Tool

The Python management tool (`tools/server_manager.py`) provides:

1. **List servers** - View all configured servers
2. **Add server** - Interactive server configuration
3. **Test connection** - Verify server connectivity
4. **Remove server** - Delete server configuration
5. **Update Claude Code** - Configure MCP in Claude Code
6. **Install dependencies** - Setup required packages

## 📁 Project Structure

```
mcp-ssh-manager/
├── src/
│   └── index.js           # Main MCP server implementation
├── tools/
│   ├── server_manager.py  # Interactive server management
│   ├── test-connection.py # Connection testing utility
│   └── requirements.txt   # Python dependencies
├── examples/
│   ├── .env.example       # Example configuration
│   ├── claude-code-config.example.json
│   ├── backup-workflow.js # Backup and restore examples
│   └── codex-ssh-config.example.toml
├── package.json           # Node.js dependencies
├── .env                   # Your server configurations (create from .env.example)
└── README.md             # This file
```

## 🧪 Testing

### Test Server Connection

```bash
python tools/test-connection.py production
```

### Verify MCP Installation

```bash
claude mcp list
```

### Check Server Status in Claude Code

```
/mcp
```

## 🔒 Security Best Practices

1. **Never commit `.env` files** - Always use `.env.example` as template
2. **Use SSH keys when possible** - More secure than passwords
3. **Limit server access** - Use minimal required permissions
4. **Rotate credentials** - Update passwords and keys regularly

## 📚 Advanced Usage

### Documentation
- [DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md) - Deployment strategies and permission handling
- [ALIASES_AND_HOOKS.md](docs/ALIASES_AND_HOOKS.md) - Command aliases and automation hooks
- Real-world examples and best practices

## 🐛 Troubleshooting

### MCP Tools Not Available

1. Ensure MCP is installed: `claude mcp list`
2. Restart Claude Code after installation
3. Check server logs for errors

### Connection Failed

1. Test connection: `python tools/test-connection.py [server_name]`
2. Verify network connectivity
3. Check firewall rules
4. Ensure SSH service is running on remote server

### Permission Denied

1. Verify username and password/key
2. Check SSH key permissions: `chmod 600 ~/.ssh/your_key`
3. Ensure user has necessary permissions on remote server

## 🛠️ Available MCP Tools

Once installed in Claude Code, you'll have access to these powerful tools:

### Core Tools
- `ssh_execute` - Execute commands on remote servers
- `ssh_upload` - Upload files to remote servers
- `ssh_download` - Download files from remote servers
- `ssh_list_servers` - List all configured SSH servers

### Advanced Tools (v2.0)
- `ssh_sync` - Bidirectional file synchronization with rsync
- `ssh_tail` - Real-time log monitoring with follow mode
- `ssh_monitor` - System metrics monitoring (CPU, RAM, disk, network)
- `ssh_history` - View command execution history

### Session Management
- `ssh_session_start` - Start persistent SSH session
- `ssh_session_send` - Send commands to active session
- `ssh_session_list` - List active sessions
- `ssh_session_close` - Close specific session

### Server Groups
- `ssh_execute_group` - Execute commands on server groups
- `ssh_group_manage` - Manage server groups (create, update, delete)

### SSH Tunnels
- `ssh_tunnel_create` - Create SSH tunnels (local, remote, SOCKS)
- `ssh_tunnel_list` - List active tunnels with statistics
- `ssh_tunnel_close` - Close specific or all tunnels

### Deployment & Security
- `ssh_deploy` - Smart deployment with permission handling
- `ssh_execute_sudo` - Execute commands with sudo privileges
- `ssh_alias` - Manage server aliases

## 📚 Usage Examples

### Backup & Restore

```
"Backup production MySQL database before deployment"
"List all backups on production server"
"Restore backup from yesterday"
"Schedule daily database backup at 2 AM"
"Backup website files excluding cache and logs"
```

For detailed backup examples, see [examples/backup-workflow.js](examples/backup-workflow.js) and [docs/BACKUP_GUIDE.md](docs/BACKUP_GUIDE.md).

### Using the Bash CLI

```bash
# Basic server management
ssh-manager server list
ssh-manager server add
ssh-manager ssh prod1

# File synchronization
ssh-manager sync push prod1 ./app /var/www/
ssh-manager sync pull prod1 /var/log/app.log ./

# SSH tunnels
ssh-manager tunnel create prod1 local 3307:localhost:3306
ssh-manager tunnel list

# Execute commands
ssh-manager exec prod1 "docker ps"
```

### Using in Claude Code or OpenAI Codex

Once installed, simply ask your AI assistant:

**Claude Code examples:**
- "List my SSH servers"
- "Execute 'df -h' on production server"
- "Upload this file to staging:/var/www/"
- "Create an SSH tunnel to access remote MySQL"
- "Monitor CPU usage on all servers"
- "Start a persistent session on prod1"

**OpenAI Codex examples:**
- "Show my SSH servers"
- "Run df -h on production"
- "Upload file.txt to staging:/tmp/"
- "Check CPU usage on all servers"

Both AI assistants support the same MCP tools! 🚀

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

### Development Setup

1. Fork the repository
2. Clone and install dependencies
3. **Setup pre-commit hooks** for code quality:
   ```bash
   ./scripts/setup-hooks.sh
   ```
4. Create your feature branch
5. Make your changes (hooks will validate on commit)
6. Push to your branch
7. Open a Pull Request

### Code Quality

This project uses automated quality checks:
- **ESLint** for JavaScript linting
- **Black** for Python formatting
- **Flake8** for Python linting
- **Prettier** for code formatting
- **Pre-commit hooks** for automated validation
- **Secret detection** to prevent credential leaks

Run validation manually: `./scripts/validate.sh`

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built for [Claude Code](https://claude.ai/code)
- Uses the [Model Context Protocol](https://modelcontextprotocol.io)
- SSH handling via [node-ssh](https://www.npmjs.com/package/node-ssh)
- Server management with [Paramiko](https://www.paramiko.org)

## 📧 Support

For issues, questions, or suggestions:
- Open an issue on [GitHub Issues](https://github.com/yourusername/mcp-ssh-manager/issues)
- Check existing issues before creating new ones

---

Made with ❤️ for the Claude Code community

## Known Limitations

### Command Timeout
- The timeout parameter for SSH commands is advisory only
- Due to SSH2 library limitations, commands may continue running on the server even after timeout
- For critical timeout needs, use the system's `timeout` command directly in your command

### SSH Sync (rsync)
- Password authentication requires `sshpass` to be installed
- SSH key authentication is recommended for better security and reliability
- Large file transfers may take time and appear to hang - be patient

### Connection Management
- Connections are pooled and reused for performance
- If a connection becomes stale, it will be automatically reconnected on next use
- Force reconnection by using the `ssh_connection_status` tool with `reconnect` action

## Support

For issues, feature requests, or contributions, please visit:
https://github.com/bvisible/mcp-ssh-manager
