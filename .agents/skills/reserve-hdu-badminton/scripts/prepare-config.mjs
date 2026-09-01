#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.BADMINTON_REPO_ROOT
  ? path.resolve(process.env.BADMINTON_REPO_ROOT)
  : path.resolve(scriptDir, '../../../..');
const profilePath = path.join(repoRoot, '.badminton-reserve', 'profile.json');
const capturePath = path.join(repoRoot, '.badminton-reserve', 'token-capture.json');
const configPath = path.join(repoRoot, 'reserve_script', 'config.json');
const allowedTimes = ['08:00', '09:00', '10:00', '11:00', '11:40', '13:20', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'];

function fail(message) {
  console.error(JSON.stringify({ ok: false, error: message }));
  process.exit(1);
}

function parseArgs(argv) {
  const result = { slots: [], tokenClipboard: false, tokenStdin: false, allowExpireBeforeOpen: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--date') result.date = argv[++i];
    else if (arg === '--slot') result.slots.push(argv[++i]);
    else if (arg === '--token-clipboard') result.tokenClipboard = true;
    else if (arg === '--token-stdin') result.tokenStdin = true;
    else if (arg === '--allow-expire-before-open') result.allowExpireBeforeOpen = true;
    else fail(`未知参数: ${arg}`);
  }
  if (!result.date) fail('缺少 --date');
  if (result.slots.length === 0) fail('至少需要一个 --slot');
  if (result.tokenClipboard === result.tokenStdin) fail('必须且只能选择 --token-clipboard 或 --token-stdin');
  return result;
}

function validateDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!match) fail('日期必须是 YYYY-MM-DD');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(year, month - 1, day);
  if (candidate.getFullYear() !== year || candidate.getMonth() !== month - 1 || candidate.getDate() !== day) fail('日期不存在');
  return value;
}

function parseSlot(value) {
  const match = /^(\d{2}:\d{2})-(\d{2}:\d{2})$/.exec(value ?? '');
  if (!match) fail(`时段格式错误: ${value}`);
  const [, start_time, end_time] = match;
  const startIndex = allowedTimes.indexOf(start_time);
  const endIndex = allowedTimes.indexOf(end_time);
  if (startIndex < 0 || endIndex < 0 || endIndex <= startIndex) fail(`不支持的时段: ${value}`);
  return { start_time, end_time };
}

async function readStdin() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  return raw.trim();
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
  fail('当前系统不支持自动读取剪贴板，请改用 --token-stdin');
}

function beijingParts(date = new Date()) {
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
  };
}

function validateToken(token, allowExpireBeforeOpen) {
  if (!/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) fail('未检测到有效的 JWT Token');
  let payload;
  try {
    payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
  } catch {
    fail('Token payload 无法解析');
  }
  const expiresAt = Number(payload.exp) * 1000;
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) fail('Token 已过期');

  if (!allowExpireBeforeOpen) {
    const now = new Date();
    const today = beijingParts(now);
    const openGuard = Date.UTC(today.year, today.month, today.day, 12, 5, 0, 0);
    if (today.hour < 20 && expiresAt < openGuard) fail('Token 无法覆盖今天北京时间 20:05，请在 15:00 后重新获取');
  }
  return expiresAt;
}

async function validateCapture(allowEarlyToken) {
  if (allowEarlyToken) return null;
  let receipt;
  try {
    receipt = JSON.parse(await readFile(capturePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') fail('未找到 Token 抓取记录。正式预约必须通过 get_token.py 在北京时间 15:00 后获取 Token');
    fail(`Token 抓取记录读取失败: ${error.message}`);
  }
  const capturedAt = new Date(receipt?.capturedAt);
  if (receipt?.version !== 1 || receipt?.mode !== 'formal' || Number.isNaN(capturedAt.getTime())) {
    fail('Token 抓取记录无效。请通过 get_token.py 重新获取 Token');
  }
  const now = new Date();
  const today = beijingParts(now);
  const capturedDay = beijingParts(capturedAt);
  const cutoff = Date.UTC(today.year, today.month, today.day, 7, 0, 0, 0);
  if (capturedDay.year !== today.year || capturedDay.month !== today.month || capturedDay.day !== today.day) {
    fail('Token 不是今天抓取的。请在今天 15:00 后重新获取 Token');
  }
  if (capturedAt.getTime() < cutoff) fail('Token 抓取时间早于今天北京时间 15:00。请重新获取 Token');
  if (capturedAt > now) fail('Token 抓取记录时间异常。请重新获取 Token');
  return capturedAt;
}

async function readProfile() {
  try {
    const profile = JSON.parse(await readFile(profilePath, 'utf8'));
    if (profile?.version !== 1 || !profile?.identity?.openid || !profile?.identity?.nickname || !profile?.identity?.phone) {
      fail('项目档案未完成，请先运行 profile.mjs init');
    }
    return profile;
  } catch (error) {
    if (error.code === 'ENOENT') fail('未找到项目档案，请先运行 profile.mjs init');
    fail(`项目档案读取失败: ${error.message}`);
  }
}

async function writePrivateJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(tempPath, filePath);
  await chmod(filePath, 0o600);
}

const args = parseArgs(process.argv.slice(2));
const profile = await readProfile();
const token = args.tokenClipboard ? readClipboard() : await readStdin();
const capturedAt = await validateCapture(args.allowExpireBeforeOpen);
const expiresAt = validateToken(token, args.allowExpireBeforeOpen);
const config = {
  token,
  date: validateDate(args.date),
  openid: profile.identity.openid,
  nickname: profile.identity.nickname,
  phone: profile.identity.phone,
  preferred_time_slots: args.slots.map(parseSlot),
  sites: profile.sites,
};
await writePrivateJson(configPath, config);
console.log(JSON.stringify({
  ok: true,
  configPath: path.relative(repoRoot, configPath),
  date: config.date,
  slots: config.preferred_time_slots,
  sites: config.sites,
  tokenExpiresAt: new Date(expiresAt).toISOString(),
  ...(capturedAt ? { tokenCapturedAt: capturedAt.toISOString() } : {}),
}, null, 2));
