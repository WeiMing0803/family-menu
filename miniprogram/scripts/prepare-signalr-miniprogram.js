const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const signalRSource = path.join(
  projectRoot,
  'node_modules',
  '@microsoft',
  'signalr',
  'dist',
  'cjs'
)
const signalRTarget = path.join(
  projectRoot,
  'miniprogram',
  'miniprogram_npm',
  '@microsoft',
  'signalr'
)
const builtEntry = path.join(signalRTarget, 'index.js')

if (!fs.existsSync(builtEntry)) {
  throw new Error('请先在微信开发者工具中执行“工具 → 构建 npm”。')
}
if (!fs.existsSync(signalRSource)) {
  throw new Error('找不到 @microsoft/signalr 的 dist/cjs 目录，请先运行 npm install。')
}

fs.mkdirSync(signalRTarget, { recursive: true })
for (const entry of fs.readdirSync(signalRSource, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith('.js') || entry.name === 'index.js') continue
  fs.copyFileSync(path.join(signalRSource, entry.name), path.join(signalRTarget, entry.name))
}

console.log('Prepared SignalR CommonJS modules for the mini-program npm package.')
