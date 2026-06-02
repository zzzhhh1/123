FROM node:18-slim

# 安装运行 Xray/sing-box 和 cloudflared 所需的必要环境
RUN apt-get update && \
    apt-get install -y curl unzip bash ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 拷贝项目信息并安装依赖（虽然我们没用外挂依赖，但这符合 Node.js 标准流程）
COPY package*.json ./
RUN npm install --production

# 拷贝项目核心脚本
COPY . .

# 仅向外暴露 3000 端口，用于提供伪装网页和下发订阅节点
# 代理流量全部由内部的 Cloudflare Tunnel 穿透，无需声明暴露
EXPOSE 3000

# 启动主程序
CMD ["npm", "start"]
