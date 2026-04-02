// 终端彩色日志 + 文件日志

import fs from 'fs';
import path from 'path';

const LOG_DIR = '.logs';
const logFile = path.join(LOG_DIR, `${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.log`);

fs.mkdirSync(LOG_DIR, { recursive: true });

function writeFile(line) {
  fs.appendFileSync(logFile, line + '\n');
}

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function timestamp() {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false });
}

export const logger = {
  info(msg) {
    const line = `[${timestamp()}] [INFO] ${msg}`;
    console.log(`${colors.gray}[${timestamp()}]${colors.reset} ${colors.cyan}[INFO]${colors.reset} ${msg}`);
    writeFile(line);
  },
  success(msg) {
    const line = `[${timestamp()}] [SUCCESS] ${msg}`;
    console.log(`${colors.gray}[${timestamp()}]${colors.reset} ${colors.green}[SUCCESS]${colors.reset} ${msg}`);
    writeFile(line);
  },
  warn(msg) {
    const line = `[${timestamp()}] [WARN] ${msg}`;
    console.log(`${colors.gray}[${timestamp()}]${colors.reset} ${colors.yellow}[WARN]${colors.reset} ${msg}`);
    writeFile(line);
  },
  error(msg) {
    const line = `[${timestamp()}] [ERROR] ${msg}`;
    console.log(`${colors.gray}[${timestamp()}]${colors.reset} ${colors.red}[ERROR]${colors.reset} ${msg}`);
    writeFile(line);
  },
  api(msg) {
    const line = `[${timestamp()}] [API] ${msg}`;
    writeFile(line);
  },
};
