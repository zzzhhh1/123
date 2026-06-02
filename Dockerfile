FROM node:18-slim

# 安装必要依赖
RUN apt-get update && \
    apt-get install -y curl unzip gzip bash ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1. 下载 cloudflared 到全局路径
RUN curl -L -s -o /usr/local/bin/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 && \
    chmod +x /usr/local/bin/cloudflared

# 2. 【终极稳定修复】：硬编码最新稳定版本，强制选用 compatible 兼容版（GOAMD64=v1）
# 彻底杜绝 GitHub API 403 封锁，并完美兼容所有新老 CPU 架构，绝不报 Illegal instruction 错误
ENV MIHOMO_VERSION=v1.19.26
RUN curl -L -s -o /tmp/mihomo.gz "https://github.com/MetaCubeX/mihomo/releases/download/${MIHOMO_VERSION}/mihomo-linux-amd64-compatible-${MIHOMO_VERSION}.gz" && \
    gunzip /tmp/mihomo.gz && \
    mv /tmp/mihomo /usr/local/bin/mihomo && \
    chmod +x /usr/local/bin/mihomo

# 3. 预下载 GeoIP 数据库并暂存到 /app 目录下
RUN curl -L -s -o /app/Country.mmdb https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/country.mmdb

COPY package*.json ./
RUN npm install --production
COPY . .

EXPOSE 3000

CMD ["npm", "start"]
