const { exec } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');

// =================【动态环境变量读取区】=================
const UUID = process.env.UUID; 
const TUNNEL_TOKEN = process.env.TUNNEL_TOKEN; 
const TUNNEL_DOMAIN = process.env.TUNNEL_DOMAIN; 
const SUB_PATH = process.env.SUB_PATH || "kjgx"; 
const PORT = parseInt(process.env.PORT) || 8001; 
// ====================================================

if (!UUID || !TUNNEL_TOKEN || !TUNNEL_DOMAIN) {
  console.error("【错误】未检测到必要的环境变量！");
  process.exit(1);
}

// 1. 生成 sing-box 配置，保存在当前工作目录的 run 文件夹下，避开系统级权限限制
const configPath = path.join(__dirname, 'run', 'config.json');

const singboxConfig = {
  log: { disabled: false, level: "warn", timestamp: true },
  inbounds: [{
    type: "vless",
    tag: "vless-in",
    listen: "127.0.0.1",
    listen_port: PORT,
    users: [{ uuid: UUID, flow: "" }],
    transport: { type: "ws", path: "/" }
  }],
  outbounds: [{ type: "direct", tag: "direct" }]
};

// 尝试写入配置文件，加上异常捕获
try {
  fs.writeFileSync(configPath, JSON.stringify(singboxConfig, null, 2));
} catch (err) {
  console.error("写入配置文件失败，可能遇到了平台的只读权限限制:", err);
  process.exit(1);
}

// 2. 伪装网页服务
http.createServer((req, res) => {
  if (req.url === `/${SUB_PATH}`) {
    const vlessLink = `vless://${UUID}@${TUNNEL_DOMAIN}:443?encryption=none&security=tls&type=ws&host=${TUNNEL_DOMAIN}&path=%2F#dcdeploy-SingBox`;
    const base64Subscription = Buffer.from(vlessLink + '\n').toString('base64');
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(base64Subscription);
  } else {
    // 尝试读取同目录下的 index.html 作为精美伪装
    fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
      if (err) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>System Running Safely</h1>');
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(data);
      }
    });
  }
}).listen(3000, '0.0.0.0', () => {
  console.log('Web server running on port 3000');
});

// 3. 极简启动逻辑：核心文件已经在 Docker 打包时就放进去了，直接运行！
// 这里不再去 /tmp 找文件，而是直接使用系统环境变量里已装好的 /usr/local/bin 命令
const bootstrapScript = `
  sing-box run -c ${configPath} > /dev/null 2>&1 &
  cloudflared tunnel --no-autoupdate run --token ${TUNNEL_TOKEN} > /dev/null 2>&1 &
`;

exec(bootstrapScript, { shell: '/bin/bash' }, (err) => {
  if (err) console.error('核心进程启动失败:', err);
});
