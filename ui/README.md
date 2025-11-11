# Glassflow ClickHouse Connector

A modern web application for configuring and managing data pipelines between Kafka and ClickHouse.

## Overview

This project provides a user-friendly interface for:

- Connecting to Kafka clusters with various security protocols
- Browsing and selecting Kafka topics
- Previewing Kafka event data
- Configuring ClickHouse connections
- Mapping Kafka event fields to ClickHouse table columns
- Setting up deduplication strategies
- Generating configuration for deployment

## Features

- **Kafka Integration**
  - Support for multiple security protocols (PLAINTEXT, SSL, SASL_PLAINTEXT, SASL_SSL)
  - Topic browsing and selection
  - Event preview with JSON formatting
  - Event navigation (oldest, newest, previous, next)
  - Event caching for improved performance

- **ClickHouse Integration**
  - Multiple connection methods (direct, proxy, connection string)
  - Database and table selection
  - Schema discovery and validation

- **Data Mapping**
  - Visual field mapping between Kafka events and ClickHouse columns
  - Type inference and conversion
  - Support for nullable fields
  - Key field designation

- **Deduplication**
  - Key-based or hash-based deduplication
  - Configurable time windows
  - Per-topic deduplication settings

- **Configuration Management**
  - Visual overview of complete configuration
  - JSON and YAML export
  - API-ready configuration generation

## Getting Started

### Prerequisites

- Node.js 20.x or higher
- pnpm 8.x or higher

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/your-org/glassflow-clickhouse.git
   cd glassflow-clickhouse
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Start the development server:

   ```bash
   pnpm dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Development

### Project Structure

- `/src/app` - Next.js pages and API routes
- `/src/components` - Reusable UI components
- `/src/modules` - Feature-specific modules
- `/src/store` - Zustand state management
- `/src/hooks` - Custom React hooks
- `/src/lib` - Utility functions and services

### Commands

- `pnpm dev` - Start the development server
- `pnpm build` - Build the application for production
- `pnpm start` - Start the production server
- `pnpm lint` - Run ESLint
- `pnpm test` - Run tests

## Configuration

The application uses environment variables for configuration. Create a `.env.local` file in the root directory with the following variables:

### Authentication (Optional)

This application supports **optional Auth0 authentication**. It is **disabled by default**.

- **To run without authentication**: No configuration needed! Just run `pnpm dev`
- **To enable authentication**: See [AUTH0_INTEGRATION.md](./AUTH0_INTEGRATION.md) for complete setup instructions

Key features:

- ✅ Zero configuration required for basic usage
- ✅ Optional authentication via environment variable
- ✅ Perfect for demos with user management
- ✅ Self-hosted deployments can opt-out completely
