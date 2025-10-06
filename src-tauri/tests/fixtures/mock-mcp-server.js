#!/usr/bin/env node

import { createInterface } from 'node:readline';
import process from 'node:process';

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });

const send = (payload) => {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
};

let nextId = 1;

rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) {
    return;
  }

  let message;
  try {
    message = JSON.parse(trimmed);
  } catch {
    return;
  }

  if (message.method === 'initialize' && message.id) {
    send({
      jsonrpc: '2.0',
      id: message.id,
      result: {
        protocolVersion: '1.0',
        capabilities: { tools: true },
        serverInfo: {
          name: 'mock-mcp-server',
          version: '1.0.0',
        },
      },
    });
    return;
  }

  if (message.method === 'notifications/initialized') {
    return;
  }

  if (message.method === 'list_tools' && message.id) {
    send({
      jsonrpc: '2.0',
      id: message.id,
      result: {
        tools: [
          {
            name: 'mockTool',
            description: 'Mock tool',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
      },
    });
    nextId += 1;
    setTimeout(() => {
      process.exit(0);
    }, 10);
    return;
  }
});

rl.on('close', () => {
  process.exit(0);
});
