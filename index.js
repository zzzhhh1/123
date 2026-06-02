const { exec } = require('child_process');
const fs = require('fs');
const http = require('http');

// =================【核心参数配置区】=================
const UUID = "把这里替换为你第一步生成的UUID"; 
const PORT = 8001;                          
const SUB_PATH = "ABCD";                    // 你的专属节点订阅路径（可以乱打几个字母）
const TUNNEL_DOMAIN = "替换为你在CF配置的子域名+主域名"; // 例如：dcd.yourdomain.com
const TUNNEL_TOKEN = "把这里替换为你刚才复制的以ey开头的完整Token"; 
// ====================================================

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

http.createServer((req, res) => {
  if (req.url === `/${SUB_PATH}`) {
    const vlessLink = `vless://${UUID}@${TUNNEL_DOMAIN}:443?encryption=none&security=tls&type=ws&host=${TUNNEL_DOMAIN}&path=%2F#dcdeploy-Argo`;
    const base64Subscription = Buffer.from(vlessLink + '\n').toString('base64');
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(base64Subscription);
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>Hello World! Welcome to my secure container.</h1>');
  }
}).listen(3000, () => {
  console.log('Web & Subscription server running on port 3000');
});

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
