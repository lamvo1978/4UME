FROM node:22-alpine AS build
WORKDIR /admin
COPY admin/package.json admin/package-lock.json ./
RUN npm ci
COPY admin/ ./
RUN npm run build

FROM nginx:1.27-alpine
COPY deploy/admin-nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /admin/dist /usr/share/nginx/html
