FROM node:18-slim

# 安装必要依赖，并在打包阶段下载 cloudflared 和最新的 Mihomo 内核
RUN apt-get update && \
    apt-get install -y curl unzip gzip bash ca-certificates jq && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1. 下载 cloudflared
RUN curl -L -s -o /usr/local/bin/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 && \
    chmod +x /usr/local/bin/cloudflared

# 2. 通过 GitHub API 动态获取并下载最新稳定版 Mihomo 内核 (.gz 格式)
RUN DOWNLOAD_URL=$(curl -s https://api.github.com/repos/MetaCubeX/mihomo/releases/latest | jq -r '.assets[] | select(.name | test("mihomo-linux-amd64-v.*\\.gz$")) | .browser_download_url' | head -n 1) && \
    curl -L -s -o /tmp/mihomo.gz "$DOWNLOAD_URL" && \
    gunzip /tmp/mihomo.gz && \
    mv /tmp/mihomo /usr/local/bin/mihomo && \
    chmod +x /usr/local/bin/mihomo

# 3. 拷贝项目依赖信息
COPY package*.json ./
RUN npm install --production

# 4. 拷贝项目核心脚本
COPY . .

# 创建运行专属目录并完全放开读写权限，彻底规避只读文件系统坑
RUN mkdir -p /app/run && chmod 777 /app/run

EXPOSE 3000

CMD ["npm", "start"]
