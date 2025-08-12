#!/usr/bin/env node

/**
 * Test script to verify environment configuration
 */

console.log('Testing Environment Configuration');
console.log('==================================');
console.log('');

// Test without environment variable
console.log('Without ENABLE_MAINNET:');
console.log('  process.env.ENABLE_MAINNET:', process.env.ENABLE_MAINNET);
console.log('  Should show testnet only: ', process.env.ENABLE_MAINNET !== 'true');
console.log('');

// Test with environment variable
process.env.ENABLE_MAINNET = 'true';
console.log('With ENABLE_MAINNET=true:');
console.log('  process.env.ENABLE_MAINNET:', process.env.ENABLE_MAINNET);
console.log('  Should show mainnet option:', process.env.ENABLE_MAINNET === 'true');
console.log('');

// Test with invalid value
process.env.ENABLE_MAINNET = 'yes';
console.log('With ENABLE_MAINNET=yes (invalid):');
console.log('  process.env.ENABLE_MAINNET:', process.env.ENABLE_MAINNET);
console.log('  Should show testnet only: ', process.env.ENABLE_MAINNET !== 'true');
console.log('');

console.log('✅ Environment configuration test complete');
console.log('');
console.log('To test in the app:');
console.log('  1. Run: pnpm dev (testnet only)');
console.log('  2. Run: ENABLE_MAINNET=true pnpm dev (both networks)');