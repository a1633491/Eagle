import { spawnSync } from 'node:child_process';

if (process.env.VERCEL === '1') {
  console.log('Skipping TypeScript build on Vercel; runtime will use source entrypoint.');
  process.exit(0);
}

const result = spawnSync('npx', ['tsc', '-p', 'tsconfig.json'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

process.exit(result.status ?? 1);
