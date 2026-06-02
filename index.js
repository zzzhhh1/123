const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');

// =================【动态环境变量读取区】=================
// 所有参数均从平台变量中动态提取，若平台未配置则自动采用安全保底值
const UUID = process.env.UUID; 
const TUNNEL_TOKEN = process.env.TUNNEL_TOKEN; 
const TUNNEL_DOMAIN = process.env.TUNNEL_DOMAIN; 
const SUB_PATH = process.env.SUB_PATH || "kjgx";                       // 默认订阅暗号为 kjgx
const PROXY_PORT = parseInt(process.env.PROXY_PORT) || 8001;           // 默认内核端口为 8001，防止和 3000 冲突
// ====================================================

// 严格的基础合规性验证
if (!UUID || !TUNNEL_TOKEN || !TUNNEL_DOMAIN) {
  console.error("【错误】未检测到必要的环境变量！请检查 dcdeploy 后台配置。");
  console.error("【提示】必须正确配置以下变量：UUID, TUNNEL_TOKEN, TUNNEL_DOMAIN");
  process.exit(1);
}

const configPath = path.join('/tmp', 'config.yaml');

// 运行时将固化在镜像里的 GeoIP 数据库复制到可写区供给内核
try {
  if (fs.existsSync('/app/Country.mmdb')) {
    fs.copyFileSync('/app/Country.mmdb', '/tmp/Country.mmdb');
  }
} catch (copyErr) {
  console.error("复制地理位置数据库失败:", copyErr);
}

// 1. 动态生成符合最新环境变量的 Mihomo 核心配置
const mihomoConfig = `
mixed-port: 7890
allow-lan: false
mode: rule
log-level: warning
external-controller: 127.0.0.1:9090

listeners:
  - name: vless-in
    type: vless
    port: ${PROXY_PORT}
    listen: 0.0.0.0
    udp: true
    uuid: ${UUID}
    transport:
      type: ws
      path: /

proxies: []
proxy-groups: []
rules:
  - MATCH,direct
`;

try {
  fs.writeFileSync(configPath, mihomoConfig.trim());
  console.log(`[系统] 成功在可写区写入临时内核配置，当前转发端口: ${PROXY_PORT}`);
} catch (err) {
  console.error("写入配置文件失败:", err);
  process.exit(1);
}

// 2. 纯净订阅与多网页随机伪装系统（专注于处理 3000 端口流量）
http.createServer((req, res) => {
  // 匹配从环境变量动态读取的暗号路径
  if (req.url === `/${SUB_PATH}`) {
    const vlessLink = `vless://${UUID}@${TUNNEL_DOMAIN}:443?encryption=none&security=tls&type=ws&host=${TUNNEL_DOMAIN}&path=%2F#dcdeploy-Mihomo`;
    const base64Subscription = Buffer.from(vlessLink + '\n').toString('base64');
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end(base64Subscription);
  }

  // 扫描伪装文件夹，随机抽取合法网页输出
  const camoDir = path.join(__dirname, 'camouflage');
  if (fs.existsSync(camoDir)) {
    try {
      const files = fs.readdirSync(camoDir);
      const htmlFiles = files.filter(f => f.endsWith('.html'));
      if (htmlFiles.length > 0) {
        const randomPage = htmlFiles[Math.floor(Math.random() * htmlFiles.length)];
        const data = fs.readFileSync(path.join(camoDir, randomPage));
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(data);
      }
    } catch (camoErr) {}
  }
  
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<h1>System Running Safely (Powered by Mihomo Engine)</h1>');
}).listen(3000, '0.0.0.0', () => {
  console.log(`=====> 伪装与客户端分发网关已成功在端口 3000 扬帆起航 <=====`);
  console.log(`[提示] 当前安全获取节点的暗号链接为: https://${TUNNEL_DOMAIN}/${SUB_PATH}`);
});

// 3. 实时日志流事件分发泵（捕获子进程事件，强行冲刷至平台控制台面板）
console.log('正在拉起后台分布式核心组件...');

const mihomoProcess = spawn('mihomo', ['-d', '/tmp', '-f', configPath]);
mihomoProcess.stdout.on('data', (data) => console.log(`[Mihomo内核] ${data.toString().trim()}`));
mihomoProcess.stderr.on('data', (data) => console.error(`[Mihomo报错] ${data.toString().trim()}`));

const cfProcess = spawn('cloudflared', ['tunnel', '--no-autoupdate', 'run', '--token', TUNNEL_TOKEN]);
cfProcess.stdout.on('data', (data) => console.log(`[CF隧道] ${data.toString().trim()}`));
cfProcess.stderr.on('data', (data) => console.log(`[CF提示] ${data.toString().trim()}`));
