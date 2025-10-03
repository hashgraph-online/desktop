import { spawn } from 'node:child_process';
import process from 'node:process';

const run = (command: string, args: string[]): Promise<void> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: false });
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
      }
    });
    child.on('error', reject);
  });

const runPnpm = async (...pnpmArgs: string[]) => {
  const execPath = process.env.npm_execpath;
  if (execPath) {
    await run(process.execPath, [execPath, ...pnpmArgs]);
  } else {
    await run('pnpm', pnpmArgs);
  }
};

const main = async (): Promise<void> => {
  await runPnpm('run', 'build:bridge');
  await run(process.execPath, ['--max-old-space-size=8192', 'node_modules/.bin/vite', 'build']);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
