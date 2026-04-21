# vigil — GitHub PR manager desktop app
# Requires: just, node, npm, @tauri-apps/cli

default:
    @just --list

# Install dependencies
install:
    npm install

# Run full Tauri app in dev mode
dev:
    npx tauri dev

# Build Tauri app for distribution
build:
    npx tauri build

# Run unit tests
test:
    npm test

# Run unit tests in watch mode
test-watch:
    npm run test:watch

# Run all checks (lint + typecheck + tests)
check: lint typecheck test

# Lint and check formatting
lint:
    npx biome check .

# Fix lint and formatting issues
fix:
    npx biome check . --write

# Type-check
typecheck:
    npx tsc --noEmit

# Remove build artifacts
clean:
    rm -rf dist src-tauri/target

# Reinstall from scratch
fresh: clean install
