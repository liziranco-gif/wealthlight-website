FROM node:22-alpine
WORKDIR /app
COPY . .
ENV NODE_ENV=production
# Website visual assets are actual JPG/PNG files in /assets.
# No chart-generating scripts run during build.
RUN node scripts/smoke-test.mjs
EXPOSE 3000
CMD ["node","server.mjs"]
