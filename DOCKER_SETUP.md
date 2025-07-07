# Docker Setup Guide

This guide covers how to build, run, and deploy the Discord bot using Docker.

## Prerequisites

- Docker installed on your system
- Docker Compose (included with Docker Desktop)
- GitHub account (for container registry)

## Quick Start

### 1. Build and Run with SQLite (Development)

```bash
# Build and run with SQLite
docker-compose --profile sqlite up --build

# Or run in background
docker-compose --profile sqlite up -d --build
```

### 2. Build and Run with PostgreSQL

```bash
# Build and run with PostgreSQL
docker-compose --profile postgresql up --build

# Or run in background
docker-compose --profile postgresql up -d --build
```

### 3. Production Deployment

```bash
# Build and run production image
docker-compose --profile production up --build
```

## Docker Images

### Multi-stage Build

The Dockerfile uses a multi-stage build with three stages:

1. **Base Stage**: Common dependencies and setup
2. **Development Stage**: Full development environment with hot reload
3. **Production Stage**: Optimized production image with minimal footprint

### Image Tags

- `discordbot:development` - Development image with hot reload
- `discordbot:production` - Production optimized image
- `ghcr.io/your-username/discordbot:latest` - Latest from GitHub Container Registry

## Environment Variables

Create a `.env` file in the bot directory:

```env
# Database Configuration
DATABASE_TYPE=sqlite  # or postgresql
DATABASE_URL=file:./dev.db  # for SQLite
# DATABASE_URL=postgresql://bot:password@postgres:5432/discordbot?schema=public  # for PostgreSQL

# Discord Bot Configuration
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=your_discord_client_id_here
DISCORD_GUILD_ID=your_discord_guild_id_here

# JWT Configuration
JWT_SECRET=your_jwt_secret_here

# API Configuration
API_PORT=3001
API_HOST=0.0.0.0
```

## Docker Compose Services

### SQLite Development
- **Service**: `discordbot-sqlite`
- **Port**: 3001
- **Database**: SQLite file
- **Profile**: `sqlite`

### PostgreSQL Development
- **Service**: `discordbot-postgresql`
- **Port**: 3002
- **Database**: PostgreSQL container
- **Profile**: `postgresql`

### Production
- **Service**: `discordbot-prod`
- **Port**: 3000
- **Database**: Configurable
- **Profile**: `production`

## Health Checks

The container includes health checks at the following endpoints:

- `/health` - Full health check with database status
- `/ready` - Readiness check
- `/live` - Liveness check

### Manual Health Check

```bash
# Check container health
docker ps

# Check health endpoint
curl http://localhost:3001/health

# Check container logs
docker logs discordbot-sqlite
```

## GitHub Actions CI/CD

### Automated Builds

The GitHub Actions workflow automatically:

1. **Builds** Docker images on push to main/develop branches
2. **Tests** images on pull requests
3. **Pushes** to GitHub Container Registry on main branch
4. **Scans** for security vulnerabilities
5. **Deploys** on version tags

### Manual Deployment

```bash
# Create a new version tag
git tag v1.0.0
git push origin v1.0.0

# Or trigger manual deployment via GitHub Actions
```

## Local Development

### Development Mode

```bash
# Start development environment
docker-compose --profile sqlite up --build

# View logs
docker-compose logs -f discordbot-sqlite

# Stop services
docker-compose down
```

### Database Management

```bash
# Switch database type in container
docker exec -it discordbot-sqlite pnpm run db:switch-postgresql

# Check database status
docker exec -it discordbot-sqlite pnpm run db:status

# Run migrations
docker exec -it discordbot-sqlite pnpm run db:migrate
```

## Production Deployment

### Using Docker Compose

```bash
# Production deployment
docker-compose --profile production up -d --build

# Scale services
docker-compose --profile production up -d --scale discordbot-prod=3
```

### Using Docker Run

```bash
# Run production container
docker run -d \
  --name discordbot-prod \
  -p 3000:3001 \
  -e DATABASE_TYPE=postgresql \
  -e DATABASE_URL="postgresql://user:pass@host:5432/db" \
  -e DISCORD_TOKEN="your-token" \
  -e DISCORD_CLIENT_ID="your-client-id" \
  -e DISCORD_GUILD_ID="your-guild-id" \
  -e JWT_SECRET="your-secret" \
  ghcr.io/your-username/discordbot:latest
```

## Monitoring and Logging

### Logs

```bash
# View container logs
docker logs discordbot-sqlite

# Follow logs in real-time
docker logs -f discordbot-sqlite

# View logs for all services
docker-compose logs
```

### Resource Usage

```bash
# Check container resource usage
docker stats

# Check disk usage
docker system df
```

## Troubleshooting

### Common Issues

1. **Container won't start**
   ```bash
   # Check logs
   docker logs discordbot-sqlite
   
   # Check environment variables
   docker exec -it discordbot-sqlite env
   ```

2. **Database connection issues**
   ```bash
   # Check database status
   docker exec -it discordbot-sqlite pnpm run db:status
   
   # Test database connection
   docker exec -it discordbot-sqlite pnpm prisma db pull
   ```

3. **Port conflicts**
   ```bash
   # Check port usage
   netstat -tulpn | grep 3001
   
   # Use different port
   docker-compose up -p 3003:3001
   ```

### Cleanup

```bash
# Remove containers and volumes
docker-compose down -v

# Remove all unused containers, networks, and images
docker system prune -a

# Remove specific images
docker rmi discordbot:development discordbot:production
```

## Security Considerations

- **Non-root user**: Production container runs as non-root user
- **Security scanning**: Trivy vulnerability scanner in CI/CD
- **Environment variables**: Sensitive data passed via environment variables
- **Health checks**: Built-in health monitoring
- **Resource limits**: Consider setting memory and CPU limits

## Performance Optimization

- **Multi-stage builds**: Reduces final image size
- **Layer caching**: Optimized Docker layer caching
- **Alpine Linux**: Lightweight base image
- **Production dependencies**: Only production dependencies in final image 