#!/usr/bin/env node

import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.BADMINTON_REPO_ROOT
  ? path.resolve(process.env.BADMINTON_REPO_ROOT)
  : path.resolve(scriptDir, '../../../..');
const stateDir = path.join(repoRoot, '.badminton-reserve');
const profilePath = path.join(stateDir, 'profile.json');
const defaultSites = [6, 5, 2, 3, 4, 1, 7, 8, 9, 10, 11, 12];

function fail(message) {
  console.error(JSON.stringify({ ok: false, error: message }));
  process.exit(1);
}

async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    fail(`无法读取项目档案: ${error.message}`);
  }
}

function validateProfile(input) {
  if (input.venuePinned !== true) fail('请先确认场馆速约已固定在钉钉工作台“我的”第一行');
  if (input.computerControlReady !== true) fail('请先确认 Agent 已设置为“完全访问（Full access）”并可操控电脑与钉钉');

  const openid = String(input.openid ?? '').trim();
  const nickname = String(input.nickname ?? '').trim();
  const phone = String(input.phone ?? '').replace(/\s+/g, '');
  if (!/^\d{4,32}$/.test(openid)) fail('学号必须是 4-32 位数字');
  if (!nickname || nickname.length > 80) fail('姓名不能为空且不能超过 80 个字符');
  if (!/^\d{11}$/.test(phone)) fail('手机号必须是 11 位数字');

  const sites = input.sites ?? defaultSites;
  if (!Array.isArray(sites) || sites.length === 0 || sites.some(site => !Number.isInteger(site) || site < 1 || site > 99)) {
    fail('场地优先级必须是非空的正整数数组');
  }

  return { openid, nickname, phone, sites };
}

async function readStdinJson() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  if (!raw.trim()) fail('init 需要从标准输入接收 JSON');
  try {
    return JSON.parse(raw);
  } catch {
    fail('标准输入不是有效 JSON');
  }
}

async function writePrivateJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  await chmod(path.dirname(filePath), 0o700);
  const tempPath = `${filePath}.${process.pid}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(tempPath, filePath);
  await chmod(filePath, 0o600);
}

async function status() {
  const profile = await readJson(profilePath);
  const configured = Boolean(
    profile?.version === 1
    && profile?.preflight?.venuePinned === true
    && profile?.preflight?.computerControlReady === true
    && profile?.identity?.openid
    && profile?.identity?.nickname
    && profile?.identity?.phone,
  );
  console.log(JSON.stringify({
    ok: true,
    configured,
    profilePath: path.relative(repoRoot, profilePath),
    sites: configured ? profile.sites : defaultSites,
  }, null, 2));
}

async function init() {
  const input = await readStdinJson();
  const validated = validateProfile(input);
  const existing = await readJson(profilePath);
  const now = new Date().toISOString();
  const profile = {
    version: 1,
    preflight: {
      venuePinned: true,
      computerControlReady: true,
      confirmedAt: existing?.preflight?.confirmedAt ?? now,
    },
    identity: {
      openid: validated.openid,
      nickname: validated.nickname,
      phone: validated.phone,
    },
    sites: validated.sites,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await writePrivateJson(profilePath, profile);
  console.log(JSON.stringify({
    ok: true,
    configured: true,
    profilePath: path.relative(repoRoot, profilePath),
    sites: profile.sites,
  }, null, 2));
}

const command = process.argv[2] ?? 'status';
if (command === 'status') await status();
else if (command === 'init') await init();
else fail(`未知命令: ${command}`);
