const { exec } = require('child_process');
const fs = require('fs');
const http = require('http');

// =================【动态环境变量读取区】=================
// 从 dcdeploy 后台配置的环境变量中安全读取，彻底告别源码泄露
const UUID = process.env.UUID; 
const TUNNEL_TOKEN = process.env.TUNNEL_TOKEN; 
const TUNNEL_DOMAIN = process.env.TUNNEL_DOMAIN; 
const SUB_PATH = process.env.SUB_PATH || "ABCD";   // 专属订阅路径，若后台未配置则默认为 ABCD
const PORT = parseInt(process.env.PORT) || 8001;   // 内部转发端口，默认为 8001
// ====================================================

// 基础合规性检查
if (!UUID || !TUNNEL_TOKEN || !TUNNEL_DOMAIN) {
  console.error("【错误】未检测到必要的环境变量！请检查 dcdeploy 后台的 UUID, TUNNEL_TOKEN, TUNNEL_DOMAIN 是否填写完整。");
  process.exit(1);
}

// 1. 动态生成 Xray 配置文件
const xrayConfig = {
  log: { access: "/dev/null", error: "/dev/null", logLevel: "warning" },
  inbounds: [{
    port: PORT,
    protocol: "vless",
    settings: {
      clients: [{ id: UUID, level: 0 }],
      decryption: "none"
    },
    streamSettings: {
      network: "ws",
      wsSettings: { path: "/" }
    }
  }],
  outbounds: [{ protocol: "direct", settings: {} }]
};

fs.writeFileSync('/tmp/xray_config.json', JSON.stringify(xrayConfig, null, 2));

// 2. 伪装网页与订阅分发服务
http.createServer((req, res) => {
  if (req.url === `/${SUB_PATH}`) {
    const vlessLink = `vless://${UUID}@${TUNNEL_DOMAIN}:443?encryption=none&security=tls&type=ws&host=${TUNNEL_DOMAIN}&path=%2F#dcdeploy-Argo`;
    const base64Subscription = Buffer.from(vlessLink + '\n').toString('base64');
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(base64Subscription);
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>System Running Safely</h1>');
  }
}).listen(3000, () => {
  console.log('Web & Subscription server running on port 3000');
});

// 3. 下载并常驻运行核心组件
const bootstrapScript = `
  set -e
  curl -L -s -o /tmp/xray.zip https://github.com/XTLS/Xray-core/releases/latest/download/Xray-linux-64.zip
  unzip -q -o /tmp/xray.zip -d /tmp/
  chmod +x /tmp/xray
  curl -L -s -o /tmp/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
  chmod +x /tmp/cloudflared
  /tmp/xray -config /tmp/xray_config.json > /dev/null 2>&1 &
  /tmp/cloudflared tunnel --no-autoupdate run --token ${TUNNEL_TOKEN} > /dev/null 2>&1 &
`;

exec(bootstrapScript, { shell: '/bin/bash' }, (err) => {
  if (err) console.error('Failed to start core services:', err);
});
