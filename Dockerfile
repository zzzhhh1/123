# 直接使用最新版 Debian 作为底层，绝对不会出现库缺失的问题
FROM debian:latest

# 更新系统并安装所有必要的工具（包括 sing-box 运行所需的 wget 和 envsubst 所需的 gettext）
RUN apt-get update && apt-get install -y curl wget unzip tzdata ca-certificates gettext-base \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 下载并安装 sing-box
RUN wget -qO /usr/local/bin/sing-box "https://github.com/SagerNet/sing-box/releases/download/v1.9.0/sing-box-1.9.0-linux-amd64" \
    && chmod +x /usr/local/bin/sing-box

# 下载并安装 cloudflared
RUN wget -qO /usr/local/bin/cloudflared "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64" \
    && chmod +x /usr/local/bin/cloudflared

# 复制配置文件和启动脚本
COPY config.template.json /etc/sing-box/config.template.json
COPY start.sh /start.sh

# 赋予执行权限
RUN chmod +x /start.sh

# 暴露端口并启动
EXPOSE 3000
CMD ["/start.sh"]
