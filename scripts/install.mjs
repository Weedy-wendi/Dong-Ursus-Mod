#!/usr/bin/env node
// scripts/install.mjs —— 兼容入口（老文档、老习惯都指向它）
// 等价于： node scripts/mod.mjs install <本体仓库> [其余参数原样透传]
// 真正的实现在 mod.mjs（install / update / uninstall / status）。
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const r = spawnSync(process.execPath, [join(here, 'mod.mjs'), 'install', ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(r.status ?? 1);
