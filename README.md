# Vite + Bun + React + Shadcn/UI Boilerplate

A modern, full-stack boilerplate that combines the speed of Vite and Bun with the power of React and beautiful Shadcn/UI components. This template provides a solid foundation for building responsive web applications with TypeScript, dark mode support, and API integration.

## Features

- ⚡ **Vite** - Lightning fast build tool and development server
- 🏃 **Bun** - Fast HTTP server with hot reload support
- ⚛️ **React 19** - Latest React with modern features
- 🎨 **Shadcn/UI** - Beautiful, accessible component library
- 📱 **Responsive Layout** - Mobile-first design with Tailwind CSS
- 🧭 **React Router** - Client-side routing with type-safe routes
- 🌙 **Dark Mode** - Built-in theme switching (light/dark/system)
- 🔗 **API Integration** - Example API endpoints with CORS setup
- 📦 **TypeScript** - Full type safety throughout the application
- 🎯 **ESLint & Prettier** - Code formatting and linting
- 🐳 **Docker** - Containerization ready with multi-stage build

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS
- **UI Components**: Shadcn/UI (built on Radix UI)
- **Build Tool**: Vite 6
- **Runtime**: Bun
- **Routing**: React Router 7
- **Styling**: Tailwind CSS 4
- **Icons**: Lucide React
- **Development**: ESLint, Prettier, Hot Module Replacement

## Project Structure

```raw
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── ui/             # Shadcn/UI components
│   │   ├── layout.tsx      # Main layout component
│   │   ├── navbar.tsx      # Navigation bar
│   │   ├── mobile-nav.tsx  # Mobile navigation
│   │   ├── mode-toggle.tsx # Dark mode toggle
│   │   └── api-test.tsx    # API testing component
│   ├── pages/              # Page components
│   ├── hooks/              # Custom React hooks
│   ├── contexts/           # React contexts
│   ├── providers/          # Provider components
│   ├── lib/                # Utility functions
│   └── routes.tsx          # Route definitions
├── server.ts               # Bun HTTP server
├── vite.config.ts          # Vite configuration
├── Dockerfile              # Docker configuration
├── docker-compose.yml      # Docker Compose setup
└── package.json            # Dependencies and scripts
```

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (latest version)
- Node.js 18+ (for compatibility)

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd gpx-track-flight
```

2. Install dependencies:

```bash
bun install
```

3. Start the development servers:

**Option 1: Frontend only (for UI development)**

```bash
bun run dev:frontend
```

This starts the Vite dev server on `http://localhost:5174`

**Option 2: Full-stack development**

```bash
# Terminal 1: Start the backend server
bun run dev:backend

# Terminal 2: Start the frontend server
bun run dev:frontend
```

The application will be available at:

- Frontend: `http://localhost:5174`
- Backend API: `http://localhost:3001`

### Available Scripts

- `bun run dev:frontend` - Start Vite development server
- `bun run dev:backend` - Start Bun server with hot reload
- `bun run build` - Build for production
- `bun run lint` - Run ESLint
- `bun run preview` - Preview production build

## API Endpoints

The boilerplate includes example API endpoints:

- `GET /api/health` - Health check endpoint
- `GET /api/version` - Version and runtime information

## Responsive Design

The layout is fully responsive with:

- Mobile-first approach using Tailwind CSS
- Collapsible mobile navigation
- Responsive grid layouts
- Touch-friendly interactions

## Dark Mode

Built-in theme switching with three options:

- **Light** - Light theme
- **Dark** - Dark theme
- **System** - Follows system preference

The theme preference is persisted across sessions.

## Development Features

- **Hot Module Replacement** - Instant updates during development
- **CORS Configuration** - Proper CORS setup for API calls
- **Type Safety** - Full TypeScript coverage
- **Component Library** - Pre-configured Shadcn/UI components
- **Routing** - Type-safe routing with React Router

<details>
<summary><strong>🐳 Docker Deployment</strong></summary>

### Building and Running with Docker

1. **Build the Docker image:**

```bash
docker build -t gpx-track-flight .
```

2. **Run the container:**

```bash
docker run -p 3000:3000 gpx-track-flight
```

The application will be available at `http://localhost:3000`

### Using Docker Compose

1. **Build and start:**

```bash
docker-compose up --build
```

2. **Stop the services:**

```bash
docker-compose down
```

### Multi-stage Build Process

The Dockerfile uses a multi-stage build for optimization:

1. **Install stage** - Installs dependencies
2. **Build stage** - Builds the Vite application
3. **Release stage** - Creates minimal production image

</details>

<details>
<summary><strong>🚀 GitHub Container Registry</strong></summary>

### Running from GitHub Container Registry

You can run the pre-built container directly from GitHub Container Registry:

```bash
docker pull ghcr.io/l3-n0x/vite-bun-react-shadcn-boilerplate:main
```

**Run the latest version:**

```bash
docker run -p 3000:3000 ghcr.io/l3-n0x/vite-bun-react-shadcn-boilerplate:main
```

**Run specific SHA version:**

```bash
docker run -p 3000:3000 ghcr.io/l3-n0x/vite-bun-react-shadcn-boilerplate:sha256-220cd5898a0cd20a582dd46eb5ef959352495a29e09826f27fa8eb1367188578.sig
```

### Available Tags

- `main` - Latest version from main branch
- `sha256-*` - Specific commit SHA versions

The container exposes port 3000 and includes both the built frontend and API server.

</details>

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run the linter: `bun run lint`
5. Build the project: `bun run build`
6. Submit a pull request

## License

This project is open source and available under the [MIT License](LICENSE).
