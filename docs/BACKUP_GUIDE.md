# Backup & Restore Guide

Complete guide for using the MCP SSH Manager backup and restore system.

## 🎯 Overview

The backup system provides automated backup and restore capabilities for:
- **MySQL** databases
- **PostgreSQL** databases
- **MongoDB** databases
- **Files and directories**
- **Scheduled automatic backups**

All backups are compressed by default, include metadata for easy management, and support automatic retention policies.

## 📋 Available Tools

### 1. `ssh_backup_create` - Create Backup

Create a one-time backup of a database or files.

**Parameters:**
- `server` (string, required) - Server name
- `type` (enum, required) - Backup type: `mysql`, `postgresql`, `mongodb`, `files`
- `name` (string, required) - Backup name (e.g., "production", "app-data")
- `database` (string, optional*) - Database name (*required for db types)
- `dbUser` (string, optional) - Database username
- `dbPassword` (string, optional) - Database password
- `dbHost` (string, optional) - Database host (default: localhost)
- `dbPort` (number, optional) - Database port
- `paths` (array, optional*) - File paths to backup (*required for files type)
- `exclude` (array, optional) - Patterns to exclude from backup
- `backupDir` (string, optional) - Backup directory (default: `/var/backups/ssh-manager`)
- `retention` (number, optional) - Retention period in days (default: 7)
- `compress` (boolean, optional) - Compress backup (default: true)

**Returns:**
```json
{
  "success": true,
  "backup_id": "mysql_production_2025-10-01T10-30-45-000Z_abc123de",
  "type": "mysql",
  "size": 52428800,
  "size_human": "50.00 MB",
  "location": "/var/backups/ssh-manager/mysql_production_2025-10-01T10-30-45-000Z_abc123de.gz",
  "metadata_path": "/var/backups/ssh-manager/mysql_production_2025-10-01T10-30-45-000Z_abc123de.meta.json",
  "created_at": "2025-10-01T10:30:45.000Z",
  "retention_days": 7
}
```

### 2. `ssh_backup_list` - List Backups

List all available backups on a server.

**Parameters:**
- `server` (string, required) - Server name
- `type` (enum, optional) - Filter by type: `mysql`, `postgresql`, `mongodb`, `files`
- `backupDir` (string, optional) - Backup directory (default: `/var/backups/ssh-manager`)

**Returns:**
```json
{
  "success": true,
  "count": 3,
  "backups": [
    {
      "id": "mysql_production_2025-10-01T10-30-45-000Z_abc123de",
      "type": "mysql",
      "created_at": "2025-10-01T10:30:45.000Z",
      "database": "myapp_prod",
      "paths": [],
      "size": 52428800,
      "size_human": "50.00 MB",
      "compressed": true,
      "retention_days": 7,
      "status": "completed"
    }
  ]
}
```

### 3. `ssh_backup_restore` - Restore Backup

Restore from a previous backup.

**Parameters:**
- `server` (string, required) - Server name
- `backupId` (string, required) - Backup ID to restore
- `database` (string, optional) - Target database name (overrides original)
- `dbUser` (string, optional) - Database username
- `dbPassword` (string, optional) - Database password
- `dbHost` (string, optional) - Database host
- `dbPort` (number, optional) - Database port
- `targetPath` (string, optional) - Target path for files restore (default: /)
- `backupDir` (string, optional) - Backup directory

**Returns:**
```json
{
  "success": true,
  "backup_id": "mysql_production_2025-10-01T10-30-45-000Z_abc123de",
  "type": "mysql",
  "restored_at": "2025-10-01T14:15:30.000Z",
  "original_created": "2025-10-01T10:30:45.000Z",
  "database": "myapp_prod",
  "paths": []
}
```

### 4. `ssh_backup_schedule` - Schedule Automatic Backups

Schedule recurring backups using cron.

**Parameters:**
- `server` (string, required) - Server name
- `schedule` (string, required) - Cron schedule (e.g., `"0 2 * * *"` for daily at 2 AM)
- `type` (enum, required) - Backup type
- `name` (string, required) - Backup name
- `database` (string, optional) - Database name (for db types)
- `paths` (array, optional) - Paths to backup (for files type)
- `retention` (number, optional) - Retention in days (default: 7)

**Returns:**
```json
{
  "success": true,
  "name": "production",
  "schedule": "0 2 * * *",
  "type": "mysql",
  "database": "myapp_prod",
  "paths": [],
  "retention_days": 7,
  "script_path": "/usr/local/bin/ssh-manager-backup-production.sh",
  "next_run": "Use crontab -l to see next run time"
}
```

## 💡 Usage Examples

### MySQL Backup

```
"Create a MySQL backup of the production database"
```

The AI will use:
```json
{
  "server": "production",
  "type": "mysql",
  "name": "prod-db",
  "database": "myapp_prod",
  "dbUser": "backup_user",
  "dbPassword": "secure_password"
}
```

### PostgreSQL Backup with Custom Retention

```
"Backup PostgreSQL database and keep it for 30 days"
```

```json
{
  "server": "staging",
  "type": "postgresql",
  "name": "staging-db",
  "database": "myapp_staging",
  "retention": 30
}
```

### Files Backup

```
"Backup the /var/www/html directory, excluding cache and logs"
```

```json
{
  "server": "web01",
  "type": "files",
  "name": "website-files",
  "paths": ["/var/www/html"],
  "exclude": ["cache/*", "*.log"]
}
```

### List All MySQL Backups

```
"List all MySQL backups on production server"
```

```json
{
  "server": "production",
  "type": "mysql"
}
```

### Restore Specific Backup

```
"Restore backup mysql_production_2025-10-01T10-30-45-000Z_abc123de"
```

```json
{
  "server": "production",
  "backupId": "mysql_production_2025-10-01T10-30-45-000Z_abc123de"
}
```

### Schedule Daily Backup at 2 AM

```
"Schedule daily MySQL backup of production database at 2 AM"
```

```json
{
  "server": "production",
  "schedule": "0 2 * * *",
  "type": "mysql",
  "name": "daily-prod",
  "database": "myapp_prod",
  "retention": 7
}
```

## 🔧 Cron Schedule Format

Common cron schedule examples:

| Schedule | Description |
|----------|-------------|
| `0 2 * * *` | Daily at 2:00 AM |
| `0 */6 * * *` | Every 6 hours |
| `0 0 * * 0` | Weekly on Sunday at midnight |
| `0 3 1 * *` | Monthly on the 1st at 3:00 AM |
| `0 1 * * 1-5` | Weekdays at 1:00 AM |
| `*/30 * * * *` | Every 30 minutes |

## 🗄️ Database-Specific Notes

### MySQL

- Uses `mysqldump` with `--single-transaction` for consistent backups
- Includes routines and triggers
- No table locking for InnoDB tables
- Compressed with gzip

**Connection options:**
- Default host: `localhost`
- Default port: `3306`
- Supports password-based auth (not recommended for production)
- Tip: Use SSH keys for secure automation

### PostgreSQL

- Uses `pg_dump` with custom format
- Includes `--clean` and `--if-exists` for safe restores
- Compressed with gzip
- Uses `PGPASSWORD` environment variable

**Connection options:**
- Default host: `localhost`
- Default port: `5432`
- Use `.pgpass` file for passwordless automation

### MongoDB

- Uses `mongodump` for database dumps
- Creates directory structure, then archives with tar
- Compressed with gzip
- Supports authentication

**Connection options:**
- Default host: `localhost`
- Default port: `27017`
- Tip: Use `--authenticationDatabase` if needed

## 📁 File Backup Notes

- Uses `tar` with gzip compression
- Supports multiple paths in single backup
- Exclude patterns use tar's `--exclude` syntax
- Preserves permissions and ownership
- Follows symlinks by default

**Exclude pattern examples:**
- `*.log` - All log files
- `cache/*` - Everything in cache directories
- `node_modules/` - Node modules directory
- `*.tmp` - All temporary files

## 🔄 Hooks Integration

The backup system integrates with the hooks system:

### Available Hooks

1. **pre-backup** - Before backup starts
   ```javascript
   // Context: { server, type, database, paths }
   ```

2. **post-backup** - After backup completes
   ```javascript
   // Context: { server, backupId, type, size, success, error }
   ```

3. **pre-restore** - Before restore starts
   ```javascript
   // Context: { server, backupId, type, database }
   ```

4. **post-restore** - After restore completes
   ```javascript
   // Context: { server, backupId, type, success, error }
   ```

### Example Hook: Slack Notification

Create `.ssh-manager/hooks/post-backup.sh`:

```bash
#!/bin/bash
# Send Slack notification after backup

if [ "$HOOK_success" = "true" ]; then
  curl -X POST -H 'Content-type: application/json' \
    --data "{\"text\":\"✅ Backup completed: $HOOK_backupId ($HOOK_size_human)\"}" \
    https://hooks.slack.com/services/YOUR/WEBHOOK/URL
fi
```

## ⚙️ Best Practices

### 1. Security

- **Never store passwords in code** - Use environment variables or `.env` files
- **Use SSH keys** for automated backups instead of passwords
- **Restrict backup directory permissions**: `chmod 700 /var/backups/ssh-manager`
- **Encrypt sensitive backups** - Add GPG encryption for critical data

### 2. Retention

- **Development**: 3-7 days retention
- **Staging**: 7-14 days retention
- **Production**: 30+ days retention
- **Compliance**: Consider regulatory requirements (GDPR, HIPAA, etc.)

### 3. Testing

- **Test restores regularly** - Monthly restore tests minimum
- **Verify backup integrity** - Check file sizes and metadata
- **Document restore procedures** - Keep runbooks updated
- **Monitor backup success** - Set up alerts for failures

### 4. Storage

- **Monitor disk space** - Ensure adequate space for retention period
- **Use compression** - Saves 60-80% space typically
- **Consider remote storage** - Sync backups to S3/cloud storage
- **Implement 3-2-1 rule** - 3 copies, 2 different media, 1 offsite

### 5. Scheduling

- **Avoid peak hours** - Schedule during low-traffic periods
- **Stagger backups** - Don't backup all servers simultaneously
- **Consider backup windows** - Large databases may take hours
- **Monitor backup duration** - Track and optimize slow backups

## 🚨 Troubleshooting

### Backup Fails with "Permission Denied"

**Solution:** Ensure backup directory exists and is writable

```bash
sudo mkdir -p /var/backups/ssh-manager
sudo chown $(whoami):$(whoami) /var/backups/ssh-manager
sudo chmod 700 /var/backups/ssh-manager
```

### MySQL Backup Shows "Access Denied"

**Solution:** Check user permissions

```sql
GRANT SELECT, LOCK TABLES, SHOW VIEW ON myapp_prod.* TO 'backup_user'@'localhost';
FLUSH PRIVILEGES;
```

### Restore Fails with "Database Does Not Exist"

**Solution:** Create target database first

```sql
CREATE DATABASE myapp_restored CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### Scheduled Backup Not Running

**Solution:** Check cron logs and permissions

```bash
# View cron logs
sudo tail -f /var/log/syslog | grep CRON

# Check if script is executable
ls -la /usr/local/bin/ssh-manager-backup-*.sh

# Test script manually
sudo /usr/local/bin/ssh-manager-backup-production.sh
```

### Backup Size Too Large

**Solutions:**
- Verify compression is enabled (`compress: true`)
- Exclude unnecessary tables or files
- Consider incremental backups (manual implementation)
- Archive old data before backup

## 📊 Monitoring

### Check Backup Status

```
"List all backups on production server"
```

### View Cron Jobs

```
"Execute 'crontab -l' on production"
```

### Check Disk Space

```
"Execute 'df -h /var/backups' on production"
```

### Calculate Total Backup Size

```
"Execute 'du -sh /var/backups/ssh-manager' on production"
```

## 🔗 Related Documentation

- [Deployment Guide](DEPLOYMENT_GUIDE.md) - Deployment workflows
- [Aliases & Hooks](ALIASES_AND_HOOKS.md) - Automation and hooks
- [Main README](../README.md) - Getting started

## ⚡ Quick Reference

### Daily Backup Workflow

1. **Create backup before deployment:**
   ```
   "Backup production MySQL database before deployment"
   ```

2. **Deploy changes:**
   ```
   "Deploy latest code to production"
   ```

3. **If rollback needed:**
   ```
   "List MySQL backups and restore the latest one"
   ```

### Disaster Recovery

1. **List available backups:**
   ```
   "List all backups on production server"
   ```

2. **Restore most recent backup:**
   ```
   "Restore backup [backup-id-here]"
   ```

3. **Verify restoration:**
   ```
   "Run database integrity check on production"
   ```

---

**Need help?** Open an issue on [GitHub](https://github.com/bvisible/mcp-ssh-manager/issues)
