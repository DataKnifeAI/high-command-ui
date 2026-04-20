# High Command UI

A modern, interactive web-based user interface for the High Command MCP Server. This React + TypeScript application provides a chat-like prompt interface for interacting with the High Command strategic management system.

## Features

- 💬 **Interactive Chat Interface** - Send commands and receive real-time responses
- 📊 **Campaign Data Display** - View war status and campaign statistics
- 🎖️ **Strategic Prompt** - Query the High Command system with natural language
- ⚡ **Real-time Updates** - Live data from the High Command MCP Server
- 🎨 **Modern UI** - Dark theme with military aesthetic

## Available Commands

- `War Status` - Get current campaign status
- `List Planets` - View all planets in the campaign
- `Show Factions` - Display faction information
- `Get Biomes` - Information about planetary biomes
- `Get Statistics` - Global game statistics

## Project Structure

```
src/
├── components/
│   ├── ChatInterface.tsx    # Main chat UI component
│   ├── ChatInterface.css    # Chat styling
│   ├── DataDisplay.tsx      # Campaign data viewer
│   └── DataDisplay.css      # Data display styling
├── services/
│   └── api.ts              # High Command API client
├── App.tsx                 # Main application component
├── App.css                 # App styling
├── index.css               # Global styles
└── main.tsx                # Entry point
```

## Setup & Installation

### Using Make (Recommended)

```bash
make install    # Install dependencies
make dev        # Start development server (port 3000)
make build      # Build for production
make preview    # Preview production build
make clean      # Clean build artifacts
make info       # Show project info
```

### Using npm

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

The application will open at `http://localhost:3000`

## Building for Production

```bash
npm run build
npm run preview
```

## Docker Support

### Using Make Commands

```bash
make docker-build   # Build Docker image
make docker-run     # Run production container on port 3000
make docker-stop    # Stop and remove container
make docker-clean   # Remove Docker image
make docker-dev     # Run development container with hot reload
```

### Using Docker Directly

**Production Build:**
```bash
docker build -t high-command-ui:latest .
docker run -d -p 3000:3000 -e API_URL=http://localhost:3001/api high-command-ui:latest
```

**Development with Hot Reload:**
```bash
docker build -t high-command-ui:dev -f Dockerfile.dev .
docker run -it -v $(pwd):/app -p 3000:3000 -e NODE_ENV=development high-command-ui:dev npm run dev
```

### Using Docker Compose

**Production Stack:**
```bash
docker-compose up -d
```

**Development Stack:**
```bash
docker-compose -f docker-compose.dev.yml up
```

## Docker Files

- **Dockerfile** - Multi-stage production build using Alpine Linux
- **Dockerfile.dev** - Development environment with hot module replacement
- **docker-compose.yml** - Production compose stack with High Command API
- **.dockerignore** - Exclude unnecessary files from Docker builds

## Configuration

The application uses environment variables for configuration. Create a `.env` file in the project root with your settings:

```bash
cp .env.example .env
```

### Environment Variables

- `VITE_API_URL` - High Command API server base URL (default: `http://localhost:5000`)
- `VITE_MCP_URL` - MCP server endpoint (default: `http://localhost:8000`)

Example `.env` file:

```env
VITE_API_URL=http://localhost:5000
VITE_MCP_URL=http://localhost:8000
```

For Docker deployments, you can pass environment variables:

```bash
docker run -e VITE_API_URL=http://api-server:5000 -p 3000:3000 high-command-ui:latest
```

## API Integration

The UI communicates with the High Command MCP Server via REST endpoints:

### Available Endpoints

- `POST /api/command` - Execute a strategic command
- `GET /api/war-status` - Fetch current war status
- `GET /api/campaign` - Get campaign information
- `GET /api/planets` - List all planets
- `GET /api/factions` - Get faction data
- `GET /api/biomes` - Get biome information
- `GET /api/statistics` - Get game statistics
- `GET /api/planets/:index` - Get specific planet status

## Testing

High Command UI includes comprehensive unit and E2E test coverage.

### Unit Testing

Unit tests are powered by **Vitest** with React Testing Library for component testing.

**Run unit tests:**
```bash
npm run test                # Run all unit tests
npm run test:ui            # Open Vitest UI dashboard
npm run test:coverage      # Generate coverage report
```

**Test files:**
- `src/test/api.test.ts` - High Command API service tests
- `src/test/claude.test.ts` - Claude AI service tests
- `src/test/ChatInterface.test.tsx` - Chat component tests
- `src/test/DataDisplay.test.tsx` - Data display component tests

**Test coverage includes:**
- ✅ API service methods and error handling
- ✅ Claude service integration and tool management
- ✅ Component rendering and user interactions
- ✅ Message submission and keyboard handling
- ✅ Loading states and error boundaries
- ✅ Data formatting and display

### UI/E2E Testing

End-to-end tests are powered by **Playwright** for full browser automation testing.

**Run E2E tests:**
```bash
npm run test:e2e           # Run all E2E tests
npx playwright test --ui   # Interactive test mode
npx playwright show-report # View HTML test report
```

**Test files:**
- `e2e/chat.spec.ts` - Chat interface integration tests

**E2E test coverage includes:**
- ✅ Welcome message display on load
- ✅ Message sending and response display
- ✅ Quick action button execution
- ✅ Tab navigation (Console, Galactic, News, etc.)
- ✅ Loading state display
- ✅ Keyboard input and Enter key submission
- ✅ Error handling and API unavailability
- ✅ Markdown rendering in responses
- ✅ Multiple sequential messages
- ✅ Rapid message submission handling

### Test Configuration

- **Vitest Config:** `vitest.config.ts` - Unit test runner configuration
- **Playwright Config:** `playwright.config.ts` - E2E test runner configuration
- **Test Setup:** `src/test/setup.ts` - Global test setup, mocks, and fixtures

### Running Tests in CI/CD

```bash
# Run all tests
npm run test && npm run test:e2e

# Generate coverage report
npm run test:coverage
```

Tests are configured to run on Chromium, Firefox, and WebKit browsers via Playwright.

## Technologies

- **React 18** - UI framework
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server
- **CSS3** - Modern styling with animations
- **Vitest** - Unit test framework
- **Playwright** - E2E test automation
- **React Testing Library** - Component testing utilities

## AI Integration

### Claude Haiku 4.5

High Command UI integrates **Claude Haiku 4.5** for advanced natural language processing and tactical decision support. Claude analyzes user queries and leverages MCP (Model Context Protocol) tools to:

- **Query Intelligence** - Understand complex strategic queries and commands
- **Context Awareness** - Maintain conversation history for multi-turn interactions
- **Tool Integration** - Automatically select and execute appropriate MCP tools:
  - `get_war_status` - Retrieve current campaign status
  - `get_planets` - Query planetary data
  - `get_campaign_info` - Fetch campaign details
  - `get_factions` - Get faction information
  - `get_biomes` - Retrieve biome data
  - `get_statistics` - Obtain game statistics

**Configuration:**
- Set `VITE_CLAUDE_API_KEY` environment variable with your Anthropic API key
- Claude is automatically enabled when the API key is present
- Falls back to keyword matching if no API key is configured

**System Prompt Features:**
- ✨ Formatted responses using Markdown (no table pipes)
- 📊 Clear data presentation with headers and bullet points
- 🎯 Tactical decision support for Hell Divers 2 command
- 🚀 Optimized for fast inference with Haiku model

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) for the full text.

Copyright 2026 DataKnifeAI
