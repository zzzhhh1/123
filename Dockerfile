FROM node:18-slim

# 安装必要依赖，加上 openssl 用于生成本地自签名证书
RUN apt-get update && \
    apt-get install -y curl unzip gzip bash ca-certificates openssl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1. 下载 cloudflared 到全局路径
RUN curl -L -s -o /usr/local/bin/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 && \
    chmod +x /usr/local/bin/cloudflared

# 2. 硬编码最新稳定版本，强制选用 compatible 兼容版（GOAMD64=v1）
ENV MIHOMO_VERSION=v1.19.26
RUN curl -L -s -o /tmp/mihomo.gz "https://github.com/MetaCubeX/mihomo/releases/download/${MIHOMO_VERSION}/mihomo-linux-amd64-compatible-${MIHOMO_VERSION}.gz" && \
    gunzip /tmp/mihomo.gz && \
    mv /tmp/mihomo /usr/local/bin/mihomo && \
    chmod +x /usr/local/bin/mihomo

# 3. 预下载 GeoIP 数据库并暂存到 /app 目录下
RUN curl -L -s -o /app/Country.mmdb https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/country.mmdb

# 4. 【HTTPS 核心修复】：在打包阶段直接非交互式生成自签名证书
RUN openssl req -x509 -newkey rsa:2048 -nodes -keyout /app/key.pem -out /app/cert.pem -days 3650 -subj "/CN=localhost"

COPY package*.json ./
RUN npm install --production
COPY . .

EXPOSE 3000

CMD ["npm", "start"]
