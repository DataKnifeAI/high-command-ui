.PHONY: help install dev build preview run test lint format clean docker-build docker-run docker-stop docker-clean docker-dev check check-all info

# Load environment variables from .env if it exists
ifneq (,$(wildcard .env))
  include .env
  export $(shell sed 's/=.*//' .env)
endif

# Default target
help:
	@echo "High Command UI - React TypeScript Application"
	@echo "================================================"
	@echo ""
	@echo "Core Targets:"
	@echo "  make install        - Install dependencies"
	@echo "  make dev            - Start development server (port 3000)"
	@echo "  make build          - Build for production"
	@echo "  make preview        - Preview production build"
	@echo "  make run            - Build and run production version"
	@echo ""
	@echo "Testing & Quality:"
	@echo "  make test           - Run unit tests (Vitest)"
	@echo "  make test-ui        - Run unit tests with UI dashboard"
	@echo "  make test-coverage  - Generate coverage report"
	@echo "  make test-e2e       - Run E2E tests (Playwright)"
	@echo "  make test-all       - Run all tests (unit + E2E)"
	@echo "  make lint           - Run TypeScript type checking"
	@echo "  make format         - Format code with prettier"
	@echo "  make check          - Run type checking and unit tests"
	@echo "  make check-all      - Format, lint, tests, and build"
	@echo ""
	@echo "Docker Targets:"
	@echo "  make docker-build   - Build Docker image"
	@echo "  make docker-login   - Login to Harbor registry (requires HARBOR_USERNAME and HARBOR_PASSWORD)"
	@echo "  make docker-push    - Build and push image to Harbor registry"
	@echo "  make docker-pull    - Pull image from Harbor registry"
	@echo "  make docker-run     - Run Docker container (port 3000)"
	@echo "  make docker-dev     - Run development container with hot reload"
	@echo "  make docker-stop    - Stop Docker container"
	@echo "  make docker-clean   - Remove Docker image"
	@echo ""
	@echo "Utilities:"
	@echo "  make clean          - Remove build artifacts and node_modules"
	@echo "  make info           - Show project information"
	@echo "  make help           - Show this help message"
	@echo ""

# Install dependencies
install:
	npm install

# Development server
dev: install
	npm run dev

# Production build
build: install
	npm run build

# Preview production build
preview: build
	npm run preview

# Run production build
run: build
	npm run preview

# Type checking and linting
lint: install
	npm run lint
	tsc --noEmit

# Code formatting (placeholder - add when prettier is installed)
format:
	@echo "Format target not configured yet. Add prettier or your formatter here."

# Unit testing with Vitest
test: install
	npm run test

# Unit testing with UI dashboard
test-ui: install
	npm run test:ui

# Test coverage report
test-coverage: install
	npm run test:coverage

# E2E testing with Playwright
test-e2e: install
	npm run test:e2e

# Run all tests (unit + E2E)
test-all: test test-e2e
	@echo "✓ All tests passed"

# Quality checks
check: lint test
	@echo "✓ Type checking and tests passed"

check-all: format lint test test-e2e build
	@echo "✓ All checks passed"

# Clean build artifacts
clean:
	rm -rf dist dist-ssr node_modules .vite
	npm cache clean --force

# Docker commands
HARBOR_REGISTRY := harbor.dataknife.net
APP_NAME := high-command-ui
HARBOR_IMAGE := $(HARBOR_REGISTRY)/library/$(APP_NAME)
IMAGE_TAG ?= latest

docker-login:
	@echo "Logging into Harbor registry..."
	@if [ -z "$$HARBOR_USERNAME" ] || [ -z "$$HARBOR_PASSWORD" ]; then \
		echo "Error: HARBOR_USERNAME and HARBOR_PASSWORD must be set"; \
		exit 1; \
	fi
	docker login $(HARBOR_REGISTRY) \
		-u "$$HARBOR_USERNAME" \
		-p "$$HARBOR_PASSWORD"

docker-build:
	docker build -t high-command-ui:latest .
	docker tag high-command-ui:latest $(HARBOR_IMAGE):$(IMAGE_TAG)

docker-push: docker-build docker-login
	docker push $(HARBOR_IMAGE):$(IMAGE_TAG)

docker-pull:
	docker pull $(HARBOR_IMAGE):$(IMAGE_TAG)
	docker tag $(HARBOR_IMAGE):$(IMAGE_TAG) high-command-ui:latest

docker-run: docker-build
	docker run -d --name high-command-ui -p 3000:3000 \
		-e VITE_API_URL=http://localhost:5000/api \
		-e VITE_MCP_URL=http://localhost:8000 \
		high-command-ui:latest

docker-dev:
	docker build -t high-command-ui:dev -f Dockerfile.dev .
	docker run --rm -it -v $(PWD):/app -p 3000:3000 \
		-e VITE_API_URL=http://localhost:5000/api \
		-e VITE_MCP_URL=http://localhost:8000 \
		-e NODE_ENV=development \
		high-command-ui:dev npm run dev

docker-stop:
	docker stop high-command-ui 2>/dev/null || true
	docker rm high-command-ui 2>/dev/null || true

docker-clean: docker-stop
	docker rmi high-command-ui:latest 2>/dev/null || true
	docker rmi high-command-ui:dev 2>/dev/null || true

# Project information
info:
	@echo "High Command UI - Project Information"
	@echo "======================================"
	@echo ""
	@echo "Framework: React 18 + TypeScript"
	@echo "Build Tool: Vite 4"
	@echo "Package Manager: npm"
	@echo ""
	@echo "Development Server: port 3000"
	@echo "API Endpoint: http://localhost:5000/api"
	@echo "MCP Endpoint: http://localhost:8000"
	@echo ""
	@echo "Status:"
	@if [ -d "node_modules" ]; then echo "  Dependencies: ✓ installed"; else echo "  Dependencies: ✗ not installed"; fi
	@if [ -d "dist" ]; then echo "  Production build: ✓ ready"; else echo "  Production build: ✗ not built"; fi
	@echo ""
	@echo "Quick Start:"
	@echo "  make install       - Install dependencies"
	@echo "  make dev           - Run development server"
	@echo "  make build         - Build for production"
	@echo "  make docker-run    - Run in Docker container"
	@echo ""
