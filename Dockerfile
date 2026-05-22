# 构建阶段
FROM node:20-alpine AS builder

WORKDIR /app

# 复制依赖文件
COPY package*.json ./
# 使用 npmmirror 镜像加速国内构建（避免 registry.npmjs.org 超时）
# Use `npm install --no-audit --no-fund` instead of `npm ci` to tolerate
# minor lockfile drift between dev machines (node 24/npm 11) and the build
# container (node 20/npm 10). The lockfile still pins exact versions for
# determinism; npm install honors it but doesn't fail on transitive resolution
# differences.
RUN npm config set registry https://registry.npmmirror.com && npm install --no-audit --no-fund

# 复制源码并构建
COPY . .
RUN npm run build-only

# 生产阶段
FROM nginx:alpine

# 运行时需要 curl(健康检查) 与 envsubst(渲染 nginx 模板)
RUN apk add --no-cache curl gettext

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制 Nginx 模板与启动脚本
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s \
  CMD curl -f http://localhost:80/health || exit 1

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
