#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chmod, mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.BADMINTON_REPO_ROOT
  ? path.resolve(process.env.BADMINTON_REPO_ROOT)
  : path.resolve(scriptDir, '../../../..');
const capturePath = path.join(repoRoot, '.badminton-reserve', 'token-capture.json');
const projectPython = process.platform === 'win32'
  ? path.join(repoRoot, '.badminton-reserve', 'venv', 'Scripts', 'python.exe')
  : path.join(repoRoot, '.badminton-reserve', 'venv', 'bin', 'python');

function fail(message) {
  console.error(JSON.stringify({ ok: false, error: message }));
  process.exit(1);
}

function parseArgs(argv) {
  if (argv.length === 0) return { test: false };
  if (argv.length === 1 && argv[0] === '--test') return { test: true };
  fail('仅支持 --test；正式预约不要传入任何参数');
}

function readClipboard() {
  try {
    if (process.platform === 'darwin') return execFileSync('pbpaste', { encoding: 'utf8' }).trim();
    if (process.platform === 'win32') {
      return execFileSync('powershell.exe', ['-NoProfile', '-Command', 'Get-Clipboard'], { encoding: 'utf8' }).trim();
    }
  } catch (error) {
    fail(`读取系统剪贴板失败: ${error.message}`);
  }
  fail('当前系统不支持自动读取剪贴板');
}

function isJwt(value) {
  return /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value);
}

async function writePrivateJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  await chmod(path.dirname(filePath), 0o700);
  const tempPath = `${filePath}.${process.pid}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(tempPath, filePath);
  await chmod(filePath, 0o600);
}

const args = parseArgs(process.argv.slice(2));
const startedAt = new Date();
if (!args.test && (startedAt.getHours() < 15)) {
  fail('正式预约禁止在 15:00 前启动 Token 抓取；请等待到今天 15:00 后重试。仅用户明确要求测试时才可使用 --test。');
}

const python = process.env.PYTHON ?? (existsSync(projectPython) ? projectPython : 'python3');
const child = spawn(python, ['token_script/get_token.py'], {
  cwd: repoRoot,
  stdio: 'inherit',
});

child.on('error', (error) => fail(`无法启动 Token 工具: ${error.message}`));
child.on('exit', async (code, signal) => {
  if (code !== 0) fail(`Token 工具未成功结束（code=${code ?? 'null'}${signal ? `, signal=${signal}` : ''}）`);
  const capturedAt = new Date();
  if (!isJwt(readClipboard())) fail('Token 工具结束后，剪贴板中未检测到有效 Token');
  await writePrivateJson(capturePath, {
    version: 1,
    capturedAt: capturedAt.toISOString(),
    mode: args.test ? 'test' : 'formal',
  });
  console.log(JSON.stringify({ ok: true, capturedAt: capturedAt.toISOString(), mode: args.test ? 'test' : 'formal' }));
});
