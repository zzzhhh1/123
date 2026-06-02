const { exec } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');

// =================【动态环境变量读取区】=================
const UUID = process.env.UUID; 
const TUNNEL_TOKEN = process.env.TUNNEL_TOKEN; 
const TUNNEL_DOMAIN = process.env.TUNNEL_DOMAIN; 
const SUB_PATH = process.env.SUB_PATH || "kjgx";   // 专属订阅路径
const PORT = parseInt(process.env.PORT) || 8001;   // 内部转发端口
// ====================================================

// 基础合规性检查
if (!UUID || !TUNNEL_TOKEN || !TUNNEL_DOMAIN) {
  console.error("【错误】未检测到必要的环境变量！请检查后台配置。");
  process.exit(1);
}

const runDir = path.join(__dirname, 'run');
const configPath = path.join(runDir, 'config.yaml');

// 1. 动态生成 Mihomo (Clash Meta) 专属的 YAML 配置文件
// 独家引入 listeners 架构，完美模拟本地入站
const mihomoConfig = `
mixed-port: 7890
allow-lan: false
mode: rule
log-level: warning
external-controller: 127.0.0.1:9090

listeners:
  - name: vless-in
    type: vless
    port: ${PORT}
    listen: 127.0.0.1
    udp: true
    uuid: ${UUID}
    transport:
      type: ws
      path: /

proxies:
proxy-groups:
rules:
  - MATCH,direct
`;

try {
  fs.writeFileSync(configPath, mihomoConfig.trim());
} catch (err) {
  console.error("写入配置文件失败，可能遇到了平台的只读权限限制:", err);
  process.exit(1);
}

// 2. 伪装网页与订阅分发服务
http.createServer((req, res) => {
  if (req.url === `/${SUB_PATH}`) {
    const vlessLink = `vless://${UUID}@${TUNNEL_DOMAIN}:443?encryption=none&security=tls&type=ws&host=${TUNNEL_DOMAIN}&path=%2F#dcdeploy-Mihomo`;
    const base64Subscription = Buffer.from(vlessLink + '\n').toString('base64');
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(base64Subscription);
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>System Running Safely (Powered by Mihomo)</h1>');
  }
}).listen(3000, '0.0.0.0', () => {
  console.log('Web & Camouflage server running on port 3000');
});

// 3. 常驻运行核心组件
// 强制指定 Mihomo 运行的工作目录 -d，避开一切潜在的相对路径报错
const bootstrapScript = `
  mihomo -d ${runDir} -f ${configPath} > /dev/null 2>&1 &
  cloudflared tunnel --no-autoupdate run --token ${TUNNEL_TOKEN} > /dev/null 2>&1 &
`;

exec(bootstrapScript, { shell: '/bin/bash' }, (err) => {
  if (err) console.error('Failed to start core services:', err);
});
