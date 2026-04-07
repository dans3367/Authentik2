#!/usr/bin/env node

/**
 * Development server launcher
 * Starts all three services: Main Server, Webhook Server, and Bounce Webhook Server
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// Colors for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function colorLog(color, ...args) {
  console.log(`${colors[color]}${args.join(' ')}${colors.reset}`);
}

// Services configuration
const services = [
  {
    name: 'Main Server',
    color: 'blue',
    command: 'tsx',
    args: ['server/index.ts'],
    env: { ...process.env, NODE_ENV: 'development', PORT: process.env.PORT || '5002' },
    cwd: projectRoot,
  },
  {
    name: 'Webhook Server',
    color: 'magenta',
    command: 'tsx',
    args: ['index.ts'],
    env: { ...process.env, NODE_ENV: 'development', WEBHOOK_PORT: '3505' },
    cwd: path.join(projectRoot, 'server-hook'),
  },
  {
    name: 'Bounce Webhook Server',
    color: 'cyan',
    command: 'tsx',
    args: ['index.ts'],
    env: { ...process.env, NODE_ENV: 'development', BOUNCE_WEBHOOK_PORT: '5003' },
    cwd: path.join(projectRoot, 'webhook-bounces'),
  },
];

// Track child processes
const children = [];

// Handle cleanup on exit
function cleanup() {
  colorLog('yellow', '\n🛑 Shutting down all services...');
  children.forEach(child => {
    if (child && !child.killed) {
      child.kill('SIGTERM');
    }
  });
  setTimeout(() => {
    colorLog('green', '✅ All services stopped');
    process.exit(0);
  }, 2000);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Start services
async function startServices() {
  colorLog('bright', '🚀 Starting Authentik Development Services');
  colorLog('bright', '='.repeat(50));

  // Build email CSS first
  colorLog('blue', '🎨 Building email CSS...');
  try {
    const { spawn } = await import('child_process');
    await new Promise((resolve, reject) => {
      const cssProcess = spawn('npm', ['run', 'build:email-css'], {
        cwd: projectRoot,
        stdio: 'pipe'
      });

      cssProcess.on('error', (err) => {
        colorLog('yellow', '⚠️ Could not spawn npm for email CSS build, continuing... ' + String(err.message || err));
        resolve();
      });

      cssProcess.on('close', (code) => {
        if (code === 0) {
          colorLog('green', '✅ Email CSS built');
          resolve();
        } else {
          colorLog('yellow', '⚠️  Email CSS build failed, continuing...');
          resolve();
        }
      });
    });
  } catch (err) {
    colorLog('yellow', '⚠️  Could not build email CSS, continuing...');
  }

  // Start each service
  for (const service of services) {
    await new Promise((resolve) => {
      colorLog(service.color, `🔧 Starting ${service.name}...`);

      const child = spawn(service.command, service.args, {
        cwd: service.cwd,
        env: service.env,
        stdio: ['inherit', 'pipe', 'pipe'],
        shell: false,
      });

      children.push(child);

      let started = false;

      child.stdout.on('data', (data) => {
        const output = data.toString();
        if (!started) {
          colorLog('green', `✅ ${service.name} started`);
          started = true;
          resolve();
        }
        // Prefix output with service name
        process.stdout.write(`[${colors[service.color]}${service.name}${colors.reset}] ${output}`);
      });

      child.stderr.on('data', (data) => {
        const output = data.toString();
        if (!started) {
          colorLog('yellow', `⚠️  ${service.name} started with warnings`);
          started = true;
          resolve();
        }
        // Prefix output with service name
        process.stderr.write(`[${colors[service.color]}${service.name}${colors.reset}] ${output}`);
      });

      child.on('error', (error) => {
        colorLog('red', `❌ Failed to start ${service.name}:`, error.message);
        resolve(); // Continue with other services
      });

      child.on('close', (code) => {
        if (!started) {
          if (code !== 0) {
            colorLog('red', `❌ ${service.name} exited before startup output with code ${code}`);
          } else {
            colorLog('yellow', `⚠️ ${service.name} exited cleanly before emitting startup output`);
          }
          started = true;
          resolve();
        } else if (code !== 0) {
          colorLog('red', `❌ ${service.name} exited with code ${code}`);
        }
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        if (!started) {
          colorLog('yellow', `⏰ ${service.name} startup timeout, assuming it started`);
          started = true;
          resolve();
        }
      }, 5000);
    });
  }

  colorLog('bright', '='.repeat(50));
  colorLog('green', '🎉 All services started!');
  colorLog('bright', '📍 Services:');
  colorLog('blue', `   • Main Server:     http://localhost:${process.env.PORT || '5002'}`);
  colorLog('magenta', '   • Webhook Server:  http://localhost:3505');
  colorLog('cyan', '   • Bounce Server:   http://localhost:5003');
  colorLog('bright', '\n🔄 Press Ctrl+C to stop all services\n');
}

// Start everything
startServices().catch(error => {
  colorLog('red', '❌ Failed to start services:', error);
  process.exit(1);
});
