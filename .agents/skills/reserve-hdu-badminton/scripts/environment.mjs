#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.BADMINTON_REPO_ROOT
  ? path.resolve(process.env.BADMINTON_REPO_ROOT)
  : path.resolve(scriptDir, '../../../..');
const venvPython = process.platform === 'win32'
  ? path.join(repoRoot, '.badminton-reserve', 'venv', 'Scripts', 'python.exe')
  : path.join(repoRoot, '.badminton-reserve', 'venv', 'bin', 'python');

function fail(message) {
  console.error(JSON.stringify({ ok: false, error: message }));
  process.exit(1);
}

function run(command, args) {
  return spawnSync(command, args, { cwd: repoRoot, encoding: 'utf8' });
}

function worksAsPython(candidate) {
  const result = run(candidate, ['--version']);
  return !result.error && result.status === 0;
}

function findPython() {
  if (process.env.PYTHON && worksAsPython(process.env.PYTHON)) return process.env.PYTHON;
  if (existsSync(venvPython) && worksAsPython(venvPython)) return venvPython;
  for (const candidate of process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python']) {
    if (worksAsPython(candidate)) return candidate;
  }
  return null;
}

function pythonVersion(python) {
  if (!python) return null;
  const result = run(python, ['--version']);
  return (result.stdout || result.stderr).trim() || null;
}

function mitmproxyInfo(python) {
  if (!python) return { version: null, installed: false };
  const importResult = run(python, ['-c', 'import mitmproxy; import mitmproxy.tools.main']);
  if (importResult.status !== 0) return { version: null, installed: false };
  const versionResult = run(python, [
    '-c',
    'from importlib.metadata import version; print(version("mitmproxy"))',
  ]);
  return {
    version: versionResult.status === 0 ? versionResult.stdout.trim() : null,
    installed: true,
  };
}

function status() {
  const python = findPython();
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  const mitmproxy = mitmproxyInfo(python);
  const result = {
    ok: nodeMajor >= 18 && Boolean(python) && mitmproxy.installed,
    node: { version: process.version, supported: nodeMajor >= 18 },
    python: python ? { command: python, version: pythonVersion(python) } : null,
    mitmproxy,
    projectPython: existsSync(venvPython) ? venvPython : null,
  };
  console.log(JSON.stringify(result, null, 2));
  return result;
}

function installMitmproxy() {
  const basePython = findPython();
  if (!basePython) fail('未找到 Python 3。请先安装 Python 3，然后重新运行环境检查。');
  const create = run(basePython, ['-m', 'venv', path.dirname(path.dirname(venvPython))]);
  if (create.status !== 0) fail(`创建项目 Python 环境失败: ${(create.stderr || create.stdout).trim()}`);
  const upgrade = run(venvPython, ['-m', 'pip', 'install', '--upgrade', 'pip']);
  if (upgrade.status !== 0) fail(`升级 pip 失败: ${(upgrade.stderr || upgrade.stdout).trim()}`);
  const install = run(venvPython, ['-m', 'pip', 'install', 'mitmproxy']);
  if (install.status !== 0) fail(`安装 mitmproxy 失败: ${(install.stderr || install.stdout).trim()}`);
  const result = status();
  if (!result.ok) fail('环境安装完成但复检未通过');
}

const command = process.argv[2] ?? 'status';
if (command === 'status') status();
else if (command === 'install-mitmproxy') installMitmproxy();
else fail('仅支持 status 或 install-mitmproxy');
