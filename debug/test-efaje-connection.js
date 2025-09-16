#!/usr/bin/env node

import { Client } from 'ssh2';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Get efaje_staging config from environment
const config = {
  host: process.env.SSH_SERVER_EFAJE_STAGING_HOST || '35.198.113.119',
  port: parseInt(process.env.SSH_SERVER_EFAJE_STAGING_PORT) || 14072,
  username: process.env.SSH_SERVER_EFAJE_STAGING_USER || 'efaje',
  password: process.env.SSH_SERVER_EFAJE_STAGING_PASSWORD || '5PIfwHx16kaEQju'
};

console.log('Testing connection to efaje_staging:');
console.log(`Host: ${config.host}`);
console.log(`Port: ${config.port}`);
console.log(`User: ${config.username}`);
console.log('Password: ***hidden***');
console.log('');

const conn = new Client();
let startTime = Date.now();

conn.on('ready', () => {
  let elapsed = Date.now() - startTime;
  console.log(`✅ Connection successful! (took ${elapsed}ms)`);

  conn.exec('echo "Test command executed successfully"', (err, stream) => {
    if (err) {
      console.error('❌ Command execution failed:', err.message);
      conn.end();
      return;
    }

    let output = '';
    stream.on('data', (data) => {
      output += data.toString();
    });

    stream.on('close', () => {
      console.log('Command output:', output.trim());
      conn.end();
    });
  });
});

conn.on('error', (err) => {
  let elapsed = Date.now() - startTime;
  console.error(`❌ Connection error after ${elapsed}ms:`, err.message);
  process.exit(1);
});

conn.on('timeout', () => {
  let elapsed = Date.now() - startTime;
  console.error(`❌ Connection timeout after ${elapsed}ms`);
  process.exit(1);
});

console.log('Starting connection attempt...');

// Try with different timeout values
conn.connect({
  host: config.host,
  port: config.port,
  username: config.username,
  password: config.password,
  readyTimeout: 60000,
  keepaliveInterval: 10000,
  algorithms: {
    kex: ['ecdh-sha2-nistp256', 'ecdh-sha2-nistp384', 'ecdh-sha2-nistp521', 'diffie-hellman-group-exchange-sha256', 'diffie-hellman-group14-sha256', 'diffie-hellman-group14-sha1'],
    cipher: ['aes128-ctr', 'aes192-ctr', 'aes256-ctr', 'aes128-gcm', 'aes256-gcm', 'aes128-cbc', 'aes192-cbc', 'aes256-cbc'],
    serverHostKey: ['ssh-rsa', 'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521', 'ssh-ed25519'],
    hmac: ['hmac-sha2-256', 'hmac-sha2-512', 'hmac-sha1']
  },
  debug: (info) => {
    console.log('[SSH2 DEBUG]', info);
  }
});