FROM node:18-slim

# 安装运行环境，并在打包阶段就下载好 sing-box 和 cloudflared
RUN apt-get update && \
    apt-get install -y curl unzip bash ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 提前下载 cloudflared 并赋予执行权限
RUN curl -L -s -o /usr/local/bin/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 && \
    chmod +x /usr/local/bin/cloudflared

# 提前下载 sing-box 并赋予执行权限
RUN LATEST_URL=$(curl -Ls -o /dev/null -w %{url_effective} https://github.com/SagerNet/sing-box/releases/latest) && \
    LATEST_VERSION=${LATEST_URL##*/} && \
    LATEST_VERSION_NO_V=${LATEST_VERSION#v} && \
    curl -L -s -o /tmp/sing-box.tar.gz "https://github.com/SagerNet/sing-box/releases/download/${LATEST_VERSION}/sing-box-${LATEST_VERSION_NO_V}-linux-amd64.tar.gz" && \
    tar -xzf /tmp/sing-box.tar.gz -C /tmp/ && \
    mv /tmp/sing-box-${LATEST_VERSION_NO_V}-linux-amd64/sing-box /usr/local/bin/sing-box && \
    chmod +x /usr/local/bin/sing-box && \
    rm -rf /tmp/sing-box*

# 拷贝项目文件
COPY package*.json ./
RUN npm install --production
COPY . .

# 创建一个专门放配置文件的本地目录，避免权限问题
RUN mkdir -p /app/run && chmod 777 /app/run

EXPOSE 3000

CMD ["npm", "start"]
