const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const net = require('net'); // 引入 net 模块，用于手搓原生 TCP 级 WebSocket 转发
const path = require('path');

// =================【动态环境变量读取区】=================
const UUID = process.env.UUID; 
const TUNNEL_TOKEN = process.env.TUNNEL_TOKEN; 
const TUNNEL_DOMAIN = process.env.TUNNEL_DOMAIN; 
const SUB_PATH = process.env.SUB_PATH || "kjgx";   
const PROXY_PORT = parseInt(process.env.PROXY_PORT) || 8001;   // 内部 Mihomo 端口
// ====================================================

if (!UUID || !TUNNEL_TOKEN || !TUNNEL_DOMAIN) {
  console.error("【错误】未检测到必要的环境变量！请检查后台配置。");
  process.exit(1);
}

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
    listen: 127.0.0.1
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

// 2. 创建全能统一 Web 服务
const server = http.createServer((req, res) => {
  // 拦截分流：如果是暗号路径，下发节点订阅
  if (req.url === `/${SUB_PATH}`) {
    const vlessLink = `vless://${UUID}@${TUNNEL_DOMAIN}:443?encryption=none&security=tls&type=ws&host=${TUNNEL_DOMAIN}&path=%2F#dcdeploy-Mihomo`;
    const base64Subscription = Buffer.from(vlessLink + '\n').toString('base64');
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end(base64Subscription);
  }

  // 其他所有普通网页请求，直接展示随机伪装网页
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
    } catch (camoErr) {
      console.error("读取随机网页失败");
    }
  }
  
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<h1>System Running Safely (Powered by Mihomo Engine)</h1>');
});

// 【核心超进化】：监听 Upgrade 事件，拦截客户端的 VLESS-WebSocket 流量并无缝转发给内部的 Mihomo
server.on('upgrade', (req, socket, head) => {
  // 建立一条到内部 Mihomo 8001 端口的流式 TCP 管道
  const proxySocket = net.connect(PROXY_PORT, '127.0.0.1', () => {
    // 重组并向 Mihomo 发送原始的 HTTP 升级请求头
    let rawRequest = `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`;
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      rawRequest += `${req.rawHeaders[i]}: ${req.rawHeaders[i+1]}\r\n`;
    }
    rawRequest += '\r\n';
    
    proxySocket.write(rawRequest);
    if (head && head.length > 0) proxySocket.write(head);
    
    // 双向管道数据绑定（正向代理和反向代理在内存中对流）
    socket.pipe(proxySocket);
    proxySocket.expand = proxySocket.pipe(socket);
  });

  proxySocket.on('error', (err) => {
    console.error('内部代理隧道转发失败:', err);
    socket.end();
  });
  socket.on('error', () => proxySocket.end());
});

// 统一监听 3000 端口
server.listen(3000, '0.0.0.0', () => {
  console.log('Unified Reverse-Proxy Web Server running on port 3000');
});

// 3. 常驻运行内部核心组件
console.log('正在拉起 Mihomo 核心进程...');
spawn('mihomo', ['-d', '/tmp', '-f', configPath], { stdio: 'inherit' });

console.log('正在拉起 Cloudflared 隧道进程...');
spawn('cloudflared', ['tunnel', '--no-autoupdate', 'run', '--token', TUNNEL_TOKEN], { stdio: 'inherit' });
