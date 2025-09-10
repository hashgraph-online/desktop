#!/usr/bin/env node

/**
 * Development server with comprehensive logging and environment variable support
 * 
 * Features:
 * - Loads environment variables from .env file
 * - Runs setup script first
 * - Spawns electron-forge start process
 * - Captures both stdout and stderr
 * - Writes output to both console AND log file
 * - Timestamps each log line with ISO format
 * - Handles process termination gracefully (Ctrl+C)
 * - Rotates log file on each run
 * - Strips ANSI codes from log file output
 * - Includes header with environment info
 */

import { spawn } from 'child_process';
import { createWriteStream, existsSync, renameSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const desktopDir = dirname(__dirname);
const envPath = join(desktopDir, '.env');

const envResult = config({ path: envPath });
if (envResult.error) {
  console.warn(`⚠️  Warning: Could not load .env file from ${envPath}:`, envResult.error.message);
} else {
  console.log(`✅ Environment variables loaded from ${envPath}`);
}

process.env.VITE_PORT = '5174';

const logFile = join(desktopDir, 'dev.log');
const prevLogFile = join(desktopDir, 'dev.prev.log');

/**
 * Strip ANSI escape codes from text
 */
function stripAnsi(text) {
   
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Format timestamp for logging
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * Rotate log files - move current to .prev
 */
function rotateLogFile() {
  if (existsSync(logFile)) {
    if (existsSync(prevLogFile)) {
      try {
        require('fs').unlinkSync(prevLogFile);
      } catch (err) {
        console.warn(`Warning: Could not remove old log file: ${err.message}`);
      }
    }
    
    try {
      renameSync(logFile, prevLogFile);
      console.log(`📋 Previous log backed up to dev.prev.log`);
    } catch (err) {
      console.warn(`Warning: Could not backup previous log: ${err.message}`);
    }
  }
}

/**
 * Create log file header with environment information
 */
function createLogHeader() {
  const nodeVersion = process.version;
  const platform = `${os.platform()} ${os.arch()}`;
  const startTime = getTimestamp();
  const port = process.env.VITE_PORT || '5173';
  
  const hederaAccountId = process.env.HEDERA_ACCOUNT_ID ? `${process.env.HEDERA_ACCOUNT_ID}` : 'NOT SET';
  const hederaOperatorId = process.env.HEDERA_OPERATOR_ID ? `${process.env.HEDERA_OPERATOR_ID}` : 'NOT SET';
  const openAiSet = process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET';
  
  return `========================================
Dev Server Started: ${startTime}
Node Version: ${nodeVersion}
Platform: ${platform}
Port: ${port}
Process ID: ${process.pid}
Working Directory: ${process.cwd()}

Environment Variables Status:
- HEDERA_ACCOUNT_ID: ${hederaAccountId}
- HEDERA_OPERATOR_ID: ${hederaOperatorId}
- OPENAI_API_KEY: ${openAiSet}
========================================
`;
}

/**
 * Log a message to both console and file
 */
function logMessage(message, isError = false, logStream) {
  const timestamp = getTimestamp();
  const strippedMessage = stripAnsi(message);
  const logLine = `[${timestamp}] ${strippedMessage}`;
  
  if (isError) {
    process.stderr.write(message);
  } else {
    process.stdout.write(message);
  }
  
  if (logStream && !logStream.destroyed) {
    logStream.write(logLine);
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('🚀 Starting development server with logging...');
  
  rotateLogFile();
  
  const logStream = createWriteStream(logFile, { flags: 'w' });
  
  const header = createLogHeader();
  logStream.write(header);
  console.log(header);
  
  const childProcesses = [];
  
  let isShuttingDown = false;
  const cleanup = (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    
    const shutdownMessage = `\n🛑 Received ${signal}, shutting down gracefully...\n`;
    console.log(shutdownMessage);
    logStream.write(`[${getTimestamp()}] ${shutdownMessage}`);
    
    childProcesses.forEach((child, index) => {
      if (child && !child.killed) {
        console.log(`📋 Terminating process ${index + 1}...`);
        logStream.write(`[${getTimestamp()}] Terminating process ${index + 1}...\n`);
        
        child.kill('SIGTERM');
        
        setTimeout(() => {
          if (!child.killed) {
            child.kill('SIGKILL');
          }
        }, 5000);
      }
    });
    
    setTimeout(() => {
      if (logStream && !logStream.destroyed) {
        logStream.end();
      }
      process.exit(0);
    }, 1000);
  };
  
  process.on('SIGINT', () => cleanup('SIGINT'));
  process.on('SIGTERM', () => cleanup('SIGTERM'));
  process.on('SIGQUIT', () => cleanup('SIGQUIT'));
  
  process.on('uncaughtException', (error) => {
    const errorMessage = `💥 Uncaught Exception: ${error.message}\n${error.stack}\n`;
    console.error(errorMessage);
    logStream.write(`[${getTimestamp()}] ${errorMessage}`);
    cleanup('UNCAUGHT_EXCEPTION');
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    const errorMessage = `💥 Unhandled Rejection at: ${promise}, reason: ${reason}\n`;
    console.error(errorMessage);
    logStream.write(`[${getTimestamp()}] ${errorMessage}`);
  });
  
  try {
    console.log('📦 Running setup script...');
    logStream.write(`[${getTimestamp()}] Running setup script...\n`);
    
    const setupProcess = spawn('npm', ['run', 'setup'], {
      cwd: desktopDir,
      stdio: 'pipe',
      shell: true,
      env: { ...process.env }
    });
    
    childProcesses.push(setupProcess);
    
    setupProcess.stdout.on('data', (data) => {
      const message = data.toString();
      logMessage(message, false, logStream);
    });
    
    setupProcess.stderr.on('data', (data) => {
      const message = data.toString();
      logMessage(message, true, logStream);
    });
    
    await new Promise((resolve, reject) => {
      setupProcess.on('exit', (code) => {
        if (code === 0) {
          const message = '✅ Setup completed successfully\n';
          console.log(message);
          logStream.write(`[${getTimestamp()}] ${message}`);
          resolve();
        } else {
          const message = `❌ Setup failed with exit code ${code}\n`;
          console.error(message);
          logStream.write(`[${getTimestamp()}] ${message}`);
          reject(new Error(`Setup failed with code ${code}`));
        }
      });
      
      setupProcess.on('error', (error) => {
        const message = `❌ Setup error: ${error.message}\n`;
        console.error(message);
        logStream.write(`[${getTimestamp()}] ${message}`);
        reject(error);
      });
    });
    
    console.log('🔧 Starting Electron Forge...');
    logStream.write(`[${getTimestamp()}] Starting Electron Forge...\n`);
    
    const electronProcess = spawn('npx', ['electron-forge', 'start'], {
      cwd: desktopDir,
      stdio: 'pipe',
      shell: true,
      env: { ...process.env }
    });
    
    childProcesses.push(electronProcess);
    
    electronProcess.stdout.on('data', (data) => {
      const message = data.toString();
      logMessage(message, false, logStream);
    });
    
    electronProcess.stderr.on('data', (data) => {
      const message = data.toString();
      logMessage(message, true, logStream);
    });
    
    electronProcess.on('exit', (code, signal) => {
      const message = signal 
        ? `🔌 Electron process terminated by signal ${signal}\n`
        : `🔌 Electron process exited with code ${code}\n`;
      
      console.log(message);
      logStream.write(`[${getTimestamp()}] ${message}`);
      
      if (!isShuttingDown) {
        cleanup('ELECTRON_EXIT');
      }
    });
    
    electronProcess.on('error', (error) => {
      const message = `❌ Electron error: ${error.message}\n`;
      console.error(message);
      logStream.write(`[${getTimestamp()}] ${message}`);
      
      if (!isShuttingDown) {
        cleanup('ELECTRON_ERROR');
      }
    });
    
    const readyMessage = '🎉 Development server started successfully. Logging to dev.log\n';
    console.log(readyMessage);
    logStream.write(`[${getTimestamp()}] ${readyMessage}`);
    
    const keepAlive = () => {
      if (!isShuttingDown) {
        setTimeout(keepAlive, 1000);
      }
    };
    keepAlive();
    
  } catch (error) {
    const errorMessage = `💥 Failed to start development server: ${error.message}\n`;
    console.error(errorMessage);
    logStream.write(`[${getTimestamp()}] ${errorMessage}`);
    
    cleanup('STARTUP_ERROR');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});