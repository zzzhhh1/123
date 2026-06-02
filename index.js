const { exec } = require('child_process');
const fs = require('fs');
const https = require('https'); // 【核心修改】：引入原生的 https 模块
const path = require('path');

// =================【动态环境变量读取区】=================
const UUID = process.env.UUID; 
const TUNNEL_TOKEN = process.env.TUNNEL_TOKEN; 
const TUNNEL_DOMAIN = process.env.TUNNEL_DOMAIN; 
const SUB_PATH = process.env.SUB_PATH || "kjgx";   
const PROXY_PORT = parseInt(process.env.PROXY_PORT) || 8001;   
// ====================================================

if (!UUID || !TUNNEL_TOKEN || !TUNNEL_DOMAIN) {
  console.error("【错误】未检测到必要的环境变量！请检查后台配置。");
  process.exit(1);
}

// 所有运行时配置文件，全部强制指引到全平台绝对可写的 /tmp 缓存区
const configPath = path.join('/tmp', 'config.yaml');

// 运行时将固化在镜像里的数据库，复制到可写区供给 Mihomo 读写
try {
  if (fs.existsSync('/app/Country.mmdb')) {
    fs.copyFileSync('/app/Country.mmdb', '/tmp/Country.mmdb');
  }
} catch (copyErr) {
  console.error("复制数据库失败，尝试继续启动:", copyErr);
}

// 1. 动态生成 Mihomo 配置
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
} catch (err) {
  console.error("写入配置文件失败:", err);
  process.exit(1);
}

// 2. 【HTTPS 核心修复】：读取在编译阶段提前准备好的自签名 SSL 证书
const sslOptions = {
  key: fs.readFileSync(path.join(__dirname, 'key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'cert.pem'))
};

// 3. 伪装网页与订阅分发（升级为原生的加密 HTTPS 服务）
https.createServer(sslOptions, (req, res) => {
  if (req.url === `/${SUB_PATH}`) {
    const vlessLink = `vless://${UUID}@${TUNNEL_DOMAIN}:443?encryption=none&security=tls&type=ws&host=${TUNNEL_DOMAIN}&path=%2F#dcdeploy-Mihomo`;
    const base64Subscription = Buffer.from(vlessLink + '\n').toString('base64');
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(base64Subscription);
  } else {
    const camoDir = path.join(__dirname, 'camouflage');
    
    if (fs.existsSync(camoDir)) {
      try {
        const files = fs.readdirSync(camoDir);
        const htmlFiles = files.filter(f => f.endsWith('.html'));
        
        if (htmlFiles.length > 0) {
          const randomPage = htmlFiles[Math.floor(Math.random() * htmlFiles.length)];
          const data = fs.readFileSync(path.join(camoDir, randomPage));
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(data);
          return;
        }
      } catch (camoErr) {
        console.error("读取随机网页失败");
      }
    }
    
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>System Running Safely (Powered by Mihomo via HTTPS)</h1>');
  }
}).listen(3000, '0.0.0.0', () => {
  console.log('Secure HTTPS Web server running on port 3000');
});

// 4. 常驻运行核心组件
const bootstrapScript = `
  mihomo -d /tmp -f ${configPath} > /dev/null 2>&1 &
  cloudflared tunnel --no-autoupdate run --token ${TUNNEL_TOKEN} > /dev/null 2>&1 &
`;

exec(bootstrapScript, { shell: '/bin/bash' }, (err) => {
  if (err) console.error('Failed to start core services:', err);
});
