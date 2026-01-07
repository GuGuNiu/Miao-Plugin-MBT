import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '../../..');
const target = path.join(root, 'Docs/渲染测试');

try {
  fs.rmSync(target, { recursive: true, force: true });
  console.log('已清理渲染测试目录');
} catch (err) {
  console.error(`清理失败: ${err.message}`);
}

console.log('调试环境已就绪');
