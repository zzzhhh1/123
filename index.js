const { exec } = require('child_process');
const fs = require('fs');
const http = require('http');

// =================【动态环境变量读取区】=================
const UUID = process.env.UUID; 
const TUNNEL_TOKEN = process.env.TUNNEL_TOKEN; 
const TUNNEL_DOMAIN = process.env.TUNNEL_DOMAIN; 
const SUB_PATH = process.env.SUB_PATH || "kjgx";   // 专属订阅路径
const PORT = parseInt(process.env.PORT) || 8001;   // 内部转发端口
// ====================================================

// 基础合规性检查
if (!UUID || !TUNNEL_TOKEN || !TUNNEL_DOMAIN) {
  console.error("【错误】未检测到必要的环境变量！请检查 dcdeploy 后台的 UUID, TUNNEL_TOKEN, TUNNEL_DOMAIN 是否填写完整。");
  process.exit(1);
}

// 1. 动态生成 sing-box 配置文件 (VLESS-WS 架构)
const singboxConfig = {
  log: {
    disabled: false,
    level: "warn",
    timestamp: true
  },
  inbounds: [
    {
      type: "vless",
      tag: "vless-in",
      listen: "127.0.0.1", // 优化为标准本地环回地址，避免网络命名空间路由错误
      listen_port: PORT,
      users: [
        {
          uuid: UUID,
          flow: "" // CF 隧道下不支持 flow，留空
        }
      ],
      transport: {
        type: "ws",
        path: "/"
      }
    }
  ],
  outbounds: [
    {
      type: "direct",
      tag: "direct"
    }
  ]
};

fs.writeFileSync('/tmp/config.json', JSON.stringify(singboxConfig, null, 2));

// 2. 伪装网页与订阅分发服务 (VLESS 节点链接格式客户端通用，无需修改)
http.createServer((req, res) => {
  if (req.url === `/${SUB_PATH}`) {
    const vlessLink = `vless://${UUID}@${TUNNEL_DOMAIN}:443?encryption=none&security=tls&type=ws&host=${TUNNEL_DOMAIN}&path=%2F#dcdeploy-SingBox`;
    const base64Subscription = Buffer.from(vlessLink + '\n').toString('base64');
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(base64Subscription);
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>System Running Safely (Powered by sing-box)</h1>');
  }
}).listen(3000, '0.0.0.0', () => { // 【关键修复】：强制绑定 0.0.0.0，允许穿透云平台防火墙
  console.log('Web & Subscription server running on port 3000');
});

// 3. 下载并常驻运行核心组件
const bootstrapScript = `
  set -e
  
  # 获取并下载 sing-box 最新版
  LATEST_URL=$(curl -Ls -o /dev/null -w %{url_effective} https://github.com/SagerNet/sing-box/releases/latest)
  LATEST_VERSION=\${LATEST_URL##*/}
  LATEST_VERSION_NO_V=\${LATEST_VERSION#v}
  
  curl -L -s -o /tmp/sing-box.tar.gz "https://github.com/SagerNet/sing-box/releases/download/\${LATEST_VERSION}/sing-box-\${LATEST_VERSION_NO_V}-linux-amd64.tar.gz"
  tar -xzf /tmp/sing-box.tar.gz -C /tmp/
  mv /tmp/sing-box-\${LATEST_VERSION_NO_V}-linux-amd64/sing-box /tmp/sing-box
  chmod +x /tmp/sing-box
  
  # 下载 cloudflared
  curl -L -s -o /tmp/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
  chmod +x /tmp/cloudflared
  
  # 后台启动服务
  /tmp/sing-box run -c /tmp/config.json > /dev/null 2>&1 &
  /tmp/cloudflared tunnel --no-autoupdate run --token ${TUNNEL_TOKEN} > /dev/null 2>&1 &
`;

exec(bootstrapScript, { shell: '/bin/bash' }, (err) => {
  if (err) console.error('Failed to start core services:', err);
});
