# Docker Setup Guide

This guide covers setting up and running the Discord bot using Docker.

## Prerequisites

- Docker and Docker Compose installed
- Discord bot token and client ID
- Git (to clone the repository)

## Quick Start

### 1. Clone and Setup
```bash
git clone <repository-url>
cd discordbot/bot
```

### 2. Environment Configuration
Create a `.env` file in the bot directory:

```env
# Discord Bot Configuration
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=your_discord_client_id_here
DISCORD_GUILD_ID=your_discord_guild_id_here

# Logging
LOG_LEVEL=info
```

### 3. Run with Docker Compose

#### Development Mode
```bash
docker-compose up --build
```

#### Production Mode
```bash
docker-compose --profile production up --build
```

## Docker Compose Profiles

### Development Profile (Default)
- Uses development Dockerfile
- Includes hot reloading
- Exposes port 3001 for development
- Mounts source code for live editing

### Production Profile
- Uses production Dockerfile
- Optimized for performance
- Minimal image size
- Runs as non-root user

## Dockerfile Stages

### Base Stage
- Node.js 18 Alpine base
- Installs pnpm package manager
- Sets up working directory

### Development Stage
- Includes all dependencies
- Copies source code
- Enables hot reloading
- Exposes development port

### Builder Stage
- Compiles TypeScript
- Builds production assets
- Optimizes for production

### Production Stage
- Minimal runtime dependencies
- Copies only built assets
- Runs as non-root user
- Optimized for security

## Volume Mounts

### Data Persistence
```yaml
volumes:
  - ./data:/app/data
  - ./logs:/app/logs
```

### Development Mounts
```yaml
volumes:
  - .:/app
  - /app/node_modules
```

## Environment Variables

### Required Variables
- `DISCORD_TOKEN`: Your Discord bot token
- `DISCORD_CLIENT_ID`: Your Discord application client ID
- `DISCORD_GUILD_ID`: Your Discord guild/server ID

### Optional Variables
- `LOG_LEVEL`: Logging level (default: info)

## Health Checks

The production container includes health checks:
- Checks bot connectivity
- Monitors resource usage
- Reports container status

## Security Features

### Non-Root User
- Container runs as user `bot` (UID 1001)
- Reduces security risks
- Follows Docker best practices

### Multi-Stage Build
- Minimizes attack surface
- Reduces image size
- Separates build and runtime dependencies

### Security Headers
- Helmet.js security middleware
- CORS configuration
- Rate limiting protection

## Troubleshooting

### Common Issues

#### Bot Not Starting
```bash
# Check logs
docker-compose logs discordbot

# Verify environment variables
docker-compose config
```

#### Permission Issues
```bash
# Fix file permissions
sudo chown -R 1001:1001 ./data ./logs
```

#### Build Failures
```bash
# Clean build cache
docker-compose build --no-cache

# Rebuild specific service
docker-compose build discordbot
```

### Debug Mode
```bash
# Run with debug logging
LOG_LEVEL=debug docker-compose up
```

## Production Deployment

### Docker Registry
```bash
# Build and push to registry
docker build -t your-registry/discordbot:latest .
docker push your-registry/discordbot:latest
```

### Kubernetes
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: discordbot
spec:
  replicas: 1
  selector:
    matchLabels:
      app: discordbot
  template:
    metadata:
      labels:
        app: discordbot
    spec:
      containers:
      - name: discordbot
        image: your-registry/discordbot:latest
        env:
        - name: DISCORD_TOKEN
          valueFrom:
            secretKeyRef:
              name: discord-secrets
              key: token
```

## Monitoring

### Log Aggregation
- Configure log drivers for production
- Use centralized logging (ELK, Fluentd)
- Set up log rotation

### Metrics
- Monitor container resource usage
- Track bot performance metrics
- Set up alerts for failures

## Backup Strategy

### Configuration
- Version control all configuration
- Backup environment variables
- Document deployment procedures

### Data
- Regular backups of persistent data
- Test restore procedures
- Store backups securely 