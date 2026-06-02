FROM node:18-slim

# 安装必要依赖
RUN apt-get update && \
    apt-get install -y curl unzip gzip bash ca-certificates jq && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1. 下载 cloudflared 到系统全局可执行路径
RUN curl -L -s -o /usr/local/bin/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 && \
    chmod +x /usr/local/bin/cloudflared

# 2. 下载最新稳定版 Mihomo 内核到系统全局可执行路径
RUN DOWNLOAD_URL=$(curl -s https://api.github.com/repos/MetaCubeX/mihomo/releases/latest | jq -r '.assets[] | select(.name | test("mihomo-linux-amd64-v.*\\.gz$")) | .browser_download_url' | head -n 1) && \
    curl -L -s -o /tmp/mihomo.gz "$DOWNLOAD_URL" && \
    gunzip /tmp/mihomo.gz && \
    mv /tmp/mihomo /usr/local/bin/mihomo && \
    chmod +x /usr/local/bin/mihomo

# 3. 预下载 GeoIP 数据库并暂存到 /app 目录下（打包固化）
RUN curl -L -s -o /app/Country.mmdb https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/country.mmdb

COPY package*.json ./
RUN npm install --production
COPY . .

EXPOSE 3000

CMD ["npm", "start"]
