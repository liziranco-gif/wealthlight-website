FROM node:22-alpine
WORKDIR /app
COPY . .
ENV NODE_ENV=production
# These are rendered once at build-time as genuine transparent PNG assets.
# CSS only positions and reveals the image layers in the browser.
RUN node scripts/render-financial-art.mjs
# Verify that the generated PNGs, pages and contact endpoint are served correctly.
RUN node scripts/smoke-test.mjs
EXPOSE 3000
CMD ["node","server.mjs"]
