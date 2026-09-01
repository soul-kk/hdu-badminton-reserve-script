#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { chmod, mkdir, open, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const repoRoot = process.env.BADMINTON_REPO_ROOT
  ? path.resolve(process.env.BADMINTON_REPO_ROOT)
  : path.resolve(scriptDir, '../../../..');
const stateDir = path.join(repoRoot, '.badminton-reserve');
const logsDir = path.join(stateDir, 'logs');
const latestPath = path.join(stateDir, 'latest-task.json');
const mainPath = path.join(repoRoot, 'reserve_script', 'main.js');
const configPath = path.join(repoRoot, 'reserve_script', 'config.json');

function fail(message) {
  console.error(JSON.stringify({ ok: false, error: message }));
  process.exit(1);
}

async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    fail(`无法读取 ${path.relative(repoRoot, filePath)}: ${error.message}`);
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  await chmod(path.dirname(filePath), 0o700);
  const tempPath = `${filePath}.${process.pid}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(tempPath, filePath);
  await chmod(filePath, 0o600);
}

function isFreshHeartbeat(state) {
  if (!state?.heartbeatAt) return false;
  return Date.now() - Date.parse(state.heartbeatAt) < 20_000;
}

async function validateConfig() {
  const config = await readJson(configPath);
  if (!config?.token || !config?.date || !config?.openid || !config?.nickname || !config?.phone) fail('运行配置缺少必填字段');
  if (!Array.isArray(config.preferred_time_slots) || config.preferred_time_slots.length === 0) fail('运行配置缺少时段');
  if (!Array.isArray(config.sites) || config.sites.length === 0) fail('运行配置缺少场地优先级');
  return config;
}

async function start() {
  const previous = await readJson(latestPath);
  if (['starting', 'running'].includes(previous?.status) && isFreshHeartbeat(previous)) fail('已有预约任务正在运行');
  const config = await validateConfig();
  const taskId = new Date().toISOString().replace(/[:.]/g, '-');
  const logPath = path.join(logsDir, `${taskId}.log`);
  await mkdir(logsDir, { recursive: true, mode: 0o700 });
  const child = spawn(process.execPath, [scriptPath, 'worker', taskId], {
    cwd: repoRoot,
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, BADMINTON_REPO_ROOT: repoRoot },
  });
  child.unref();
  const state = {
    version: 1,
    taskId,
    status: 'starting',
    pid: child.pid,
    childPid: null,
    startedAt: new Date().toISOString(),
    heartbeatAt: new Date().toISOString(),
    finishedAt: null,
    exitCode: null,
    logPath: path.relative(repoRoot, logPath),
    request: {
      date: config.date,
      slots: config.preferred_time_slots,
      sites: config.sites,
    },
  };
  await writeJson(latestPath, state);
  console.log(JSON.stringify({ ok: true, ...state }, null, 2));
}

async function waitForState(taskId) {
  for (let i = 0; i < 40; i += 1) {
    const state = await readJson(latestPath);
    if (state?.taskId === taskId) return state;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('后台任务状态初始化超时');
}

async function worker(taskId) {
  let state = await waitForState(taskId);
  const logPath = path.join(repoRoot, state.logPath);
  const logHandle = await open(logPath, 'a', 0o600);
  const testExitCode = process.env.BADMINTON_TASK_TEST_EXIT_CODE;
  const testDelayMs = Number(process.env.BADMINTON_TASK_TEST_DELAY_MS ?? 0);
  if (testExitCode !== undefined && !/^[01]$/.test(testExitCode)) throw new Error('BADMINTON_TASK_TEST_EXIT_CODE 只允许 0 或 1');
  if (!Number.isInteger(testDelayMs) || testDelayMs < 0 || testDelayMs > 60_000) throw new Error('BADMINTON_TASK_TEST_DELAY_MS 必须是 0-60000 的整数');
  const commandArgs = testExitCode === undefined
    ? [mainPath]
    : ['-e', `setTimeout(() => process.exit(${testExitCode}), ${testDelayMs})`];
  const child = spawn(process.execPath, commandArgs, {
    cwd: repoRoot,
    stdio: ['ignore', logHandle.fd, logHandle.fd],
    windowsHide: true,
  });
  const wakeLock = process.platform === 'darwin'
    ? spawn('/usr/bin/caffeinate', ['-dimsu', '-w', String(child.pid)], { stdio: 'ignore' })
    : null;
  state = {
    ...state,
    status: 'running',
    pid: process.pid,
    childPid: child.pid,
    heartbeatAt: new Date().toISOString(),
  };
  await writeJson(latestPath, state);

  const heartbeat = setInterval(async () => {
    const current = await readJson(latestPath);
    if (current?.taskId !== taskId || current.status !== 'running') return;
    await writeJson(latestPath, { ...current, heartbeatAt: new Date().toISOString() });
  }, 5_000);
  heartbeat.unref();

  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    clearInterval(heartbeat);
    try { child.kill('SIGINT'); } catch {}
    try { wakeLock?.kill('SIGTERM'); } catch {}
    const current = await readJson(latestPath);
    if (current?.taskId === taskId) {
      await writeJson(latestPath, {
        ...current,
        status: 'cancelled',
        heartbeatAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        exitCode: null,
      });
    }
    await logHandle.close();
    process.exit(0);
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);

  child.on('exit', async code => {
    if (stopping) return;
    clearInterval(heartbeat);
    try { wakeLock?.kill('SIGTERM'); } catch {}
    const current = await readJson(latestPath);
    if (current?.taskId === taskId) {
      await writeJson(latestPath, {
        ...current,
        status: code === 0 ? 'success' : 'failed',
        heartbeatAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        exitCode: code,
      });
    }
    await logHandle.close();
    process.exit(code ?? 1);
  });
}

async function status() {
  let state = await readJson(latestPath);
  if (!state) {
    console.log(JSON.stringify({ ok: true, status: 'none' }, null, 2));
    return;
  }
  if (['starting', 'running'].includes(state.status) && !isFreshHeartbeat(state)) {
    state = {
      ...state,
      status: 'interrupted',
      finishedAt: new Date().toISOString(),
    };
    await writeJson(latestPath, state);
  }
  let logTail = '';
  try {
    const content = await readFile(path.join(repoRoot, state.logPath), 'utf8');
    logTail = content.split(/\r?\n/).slice(-40).join('\n');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  console.log(JSON.stringify({ ok: true, ...state, logTail }, null, 2));
}

async function stop() {
  const state = await readJson(latestPath);
  if (!state || !['starting', 'running'].includes(state.status)) fail('没有正在运行的预约任务');
  if (!isFreshHeartbeat(state)) fail('任务心跳已失效，为避免终止无关进程，不执行 stop');
  process.kill(state.pid, 'SIGTERM');
  console.log(JSON.stringify({ ok: true, stopping: true, taskId: state.taskId }, null, 2));
}

const command = process.argv[2] ?? 'status';
if (command === 'start') await start();
else if (command === 'worker') await worker(process.argv[3]);
else if (command === 'status') await status();
else if (command === 'stop') await stop();
else fail(`未知命令: ${command}`);
