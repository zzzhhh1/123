# 阶段一：获取官方 sing-box
FROM ghcr.io/sagernet/sing-box:latest AS singbox-builder

# 阶段二：获取官方 cloudflared
FROM cloudflare/cloudflared:latest AS cloudflared-builder

# 阶段三：最终镜像
FROM alpine:latest

# 安装必要依赖，特别是 gettext（其中包含了 envsubst 工具）
RUN apk update && apk add --no-cache ca-certificates tzdata gettext && update-ca-certificates

# 提取核心程序
COPY --from=singbox-builder /usr/local/bin/sing-box /usr/local/bin/sing-box
COPY --from=cloudflared-builder /usr/local/bin/cloudflared /usr/local/bin/cloudflared

RUN chmod +x /usr/local/bin/sing-box /usr/local/bin/cloudflared

# 复制模板文件和启动脚本
COPY config.template.json /etc/sing-box/config.template.json
COPY start.sh /start.sh
RUN chmod +x /start.sh

CMD ["/start.sh"]
