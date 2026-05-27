# use the official Bun image
# see all versions at https://hub.docker.com/r/oven/bun/tags
FROM oven/bun:1 AS base
WORKDIR /usr/src/app

# install dependencies into temp directory
# this will cache them and speed up future builds
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lock /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

# copy node_modules from temp directory
# then copy all (non-ignored) project files into the image
FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

# build the Vite project
ENV NODE_ENV=production
RUN bun run build

# copy built static files and server into final image
FROM base AS release
WORKDIR /usr/src/app
COPY --chown=bun:bun --from=prerelease /usr/src/app/dist ./dist
COPY --chown=bun:bun --from=prerelease /usr/src/app/server.ts .
COPY --chown=bun:bun --from=prerelease /usr/src/app/node_modules ./node_modules
COPY --chown=bun:bun --from=prerelease /usr/src/app/prisma ./prisma
COPY --chown=bun:bun --from=prerelease /usr/src/app/prisma.config.ts .
COPY --chown=bun:bun --from=prerelease /usr/src/app/package.json .

# Set up write permissions for sqlite database in /data
USER root
RUN mkdir -p /data && chown -R bun:bun /data
USER bun

# set production environment and run the full-stack server
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000/tcp
ENTRYPOINT [ "sh", "-c", "bunx prisma migrate deploy && bun run server.ts" ]
