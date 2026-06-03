#!/bin/sh

# ==========================================
# 1. 检查必要的环境变量
# ==========================================
if [ -z "$UUID" ]; then
    echo "[错误] 未设置 UUID 环境变量！"
    exit 1
fi

if [ -z "$ARGO_TOKEN" ]; then
    echo "[错误] 未设置 ARGO_TOKEN 环境变量！"
    exit 1
fi

# ==========================================
# 2. 启动健康检查伪装服务 (防平台误杀，极其关键)
# ==========================================
HEALTH_PORT=${PORT:-8080}
echo "[INFO] 启动健康检查伪装服务，监听端口: $HEALTH_PORT"
# 在后台静默跑一个 HTTP 服务应付探针。如果您的镜像没装 python3，请换成: busybox httpd -p $HEALTH_PORT -h /tmp
nohup python3 -m http.server $HEALTH_PORT >/dev/null 2>&1 &

# ==========================================
# 3. 动态生成配置并启动 sing-box
# ==========================================
echo "[INFO] 正在生成配置文件..."
envsubst < /etc/sing-box/config.template.json > /etc/sing-box/config.json

echo "[INFO] 正在启动 sing-box..."
# 建议使用 nohup 并重定向日志输出，防止长时间运行导致日志撑爆内存 (OOM)
nohup sing-box run -c /etc/sing-box/config.json >/dev/null 2>&1 &

# 等待 2 秒，确保本地端口已完全监听
sleep 2

# ==========================================
# 4. 前台运行 Cloudflare Argo Tunnel
# ==========================================
echo "[INFO] 正在启动 Cloudflare Argo Tunnel..."
cloudflared tunnel --no-autoupdate --protocol http2 run --token ${ARGO_TOKEN}
