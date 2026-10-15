# Development image shared by every workspace service.
#
# This is deliberately not a production image: it installs dev dependencies and
# the services built on it run watch-mode commands. Both `backend` and
# `frontend` reuse this image and differ only by the command compose gives them.
FROM node:26

WORKDIR /app

# Install workspace dependencies against the root lockfile. Only the manifests
# are copied first so this layer is cached until a package.json changes.
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
COPY packages/config/package.json ./packages/config/package.json
COPY packages/domain/package.json ./packages/domain/package.json
COPY packages/ui/package.json ./packages/ui/package.json

RUN npm ci

# Copy the remaining workspace. `node_modules`, `.env`, build output, and `.git`
# are excluded by .dockerignore. At runtime compose bind-mounts the repo root
# over this path, so host edits hot-reload in place.
COPY . .

# Default command; services override it with their own dev command.
CMD ["npm", "run", "dev", "--workspace", "backend"]
