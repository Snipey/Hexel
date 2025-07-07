# GitHub Container Registry Guide

This guide covers how to use GitHub Container Registry (ghcr.io) for your Discord bot Docker images.

## Overview

GitHub Container Registry provides a secure, reliable way to store and distribute your Docker images. It's integrated with GitHub Actions and provides unlimited public packages and 500MB of free storage for private packages.

## Registry Information

- **Registry URL**: `ghcr.io`
- **Image Format**: `ghcr.io/OWNER/REPOSITORY/IMAGE_NAME:TAG`
- **Example**: `ghcr.io/your-username/discordbot:latest`

## Automatic Image Publishing

### How It Works

1. **Push to main/develop**: Automatically builds and pushes images
2. **Create tags**: Automatically creates versioned releases
3. **Pull requests**: Builds and tests images without publishing

### Image Tags

The workflow automatically creates these tags:

- `latest` - Latest build from main branch
- `main` - Latest build from main branch
- `develop` - Latest build from develop branch
- `v1.0.0` - Version tags (semantic versioning)
- `v1.0` - Major.minor version tags
- `main-abc123` - Branch-specific tags with commit SHA

## Using the Images

### Pull Images

```bash
# Pull latest image
docker pull ghcr.io/your-username/discordbot:latest

# Pull specific version
docker pull ghcr.io/your-username/discordbot:v1.0.0

# Pull development version
docker pull ghcr.io/your-username/discordbot:develop
```

### Run Containers

```bash
# Run with SQLite (default)
docker run -d \
  --name discordbot \
  -p 3001:3001 \
  -e DISCORD_TOKEN="your_token" \
  -e DISCORD_CLIENT_ID="your_client_id" \
  -e DISCORD_GUILD_ID="your_guild_id" \
  -e JWT_SECRET="your_secret" \
  ghcr.io/your-username/discordbot:latest

# Run with PostgreSQL
docker run -d \
  --name discordbot \
  -p 3001:3001 \
  -e DATABASE_TYPE=postgresql \
  -e DATABASE_URL="postgresql://user:pass@host:5432/db" \
  -e DISCORD_TOKEN="your_token" \
  -e DISCORD_CLIENT_ID="your_client_id" \
  -e DISCORD_GUILD_ID="your_guild_id" \
  -e JWT_SECRET="your_secret" \
  ghcr.io/your-username/discordbot:latest
```

### Using Docker Compose

```bash
# Set your repository name
export GITHUB_REPOSITORY="your-username/discordbot"

# Run with SQLite
docker-compose --profile sqlite up -d

# Run with PostgreSQL
docker-compose --profile postgresql up -d

# Run production
docker-compose --profile production up -d
```

## GitHub Actions Workflows

### 1. Docker Build Workflow

**File**: `.github/workflows/docker-build.yml`

**Triggers**:
- Push to main/develop branches
- Push tags (v*)
- Pull requests

**Features**:
- Multi-platform builds (linux/amd64, linux/arm64)
- Automatic tagging
- Security scanning with Trivy
- Container testing

### 2. Container Registry Management

**File**: `.github/workflows/container-registry.yml`

**Features**:
- Automated cleanup of old images
- Image listing and information
- Release publishing
- Scheduled maintenance

**Manual Actions**:
```bash
# Trigger cleanup
gh workflow run container-registry.yml -f action=cleanup

# List images
gh workflow run container-registry.yml -f action=list

# Get registry info
gh workflow run container-registry.yml -f action=info
```

## Creating Releases

### Automatic Release Creation

1. **Create a version tag**:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. **Workflow automatically**:
   - Builds the image
   - Tags with version
   - Creates GitHub release
   - Publishes to container registry

### Manual Release

```bash
# Create and push tag
git tag v1.0.0
git push origin v1.0.0

# Or trigger manually via GitHub Actions
```

## Registry Management

### Viewing Images

1. **GitHub UI**: Go to your repository → Packages tab
2. **Docker CLI**: `docker images ghcr.io/your-username/discordbot`
3. **GitHub Actions**: Run the "list" action

### Image Information

```bash
# Get image details
docker inspect ghcr.io/your-username/discordbot:latest

# Check image layers
docker history ghcr.io/your-username/discordbot:latest

# Get image size
docker images ghcr.io/your-username/discordbot --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}"
```

### Cleanup

The workflow automatically cleans up old images, but you can also:

```bash
# Remove specific image
docker rmi ghcr.io/your-username/discordbot:v0.9.0

# Remove all images
docker rmi $(docker images ghcr.io/your-username/discordbot -q)

# Trigger cleanup workflow
gh workflow run container-registry.yml -f action=cleanup
```

## Security Features

### Vulnerability Scanning

- **Trivy Scanner**: Automatically scans images for vulnerabilities
- **GitHub Security Tab**: Results appear in repository security tab
- **SARIF Format**: Standardized security report format

### Access Control

- **Public Images**: Available to everyone
- **Private Images**: Require authentication
- **Organization**: Control access at organization level

### Authentication

```bash
# Login to registry
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Or use GitHub CLI
gh auth token | docker login ghcr.io -u USERNAME --password-stdin
```

## Best Practices

### Image Tagging

- Use semantic versioning for releases
- Keep `latest` tag updated
- Use branch names for development builds
- Include commit SHA for traceability

### Security

- Regularly update base images
- Scan for vulnerabilities
- Use minimal base images
- Run as non-root user

### Performance

- Use multi-stage builds
- Optimize layer caching
- Minimize image size
- Use appropriate base images

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   ```bash
   # Check token permissions
   gh auth status
   
   # Re-authenticate
   gh auth login
   ```

2. **Image Not Found**
   ```bash
   # Check if image exists
   docker pull ghcr.io/your-username/discordbot:latest
   
   # Check available tags
   gh workflow run container-registry.yml -f action=list
   ```

3. **Build Failures**
   - Check GitHub Actions logs
   - Verify Dockerfile syntax
   - Check resource limits

### Debugging

```bash
# Check workflow status
gh run list --workflow=docker-build.yml

# View workflow logs
gh run view --log

# Check registry permissions
gh api user/packages
```

## Migration from Other Registries

### From Docker Hub

```bash
# Pull from Docker Hub
docker pull your-username/discordbot:latest

# Tag for GitHub Container Registry
docker tag your-username/discordbot:latest ghcr.io/your-username/discordbot:latest

# Push to GitHub Container Registry
docker push ghcr.io/your-username/discordbot:latest
```

### From Private Registry

```bash
# Login to private registry
docker login your-registry.com

# Pull and retag
docker pull your-registry.com/discordbot:latest
docker tag your-registry.com/discordbot:latest ghcr.io/your-username/discordbot:latest

# Push to GitHub Container Registry
docker push ghcr.io/your-username/discordbot:latest
```

## Cost and Limits

### Free Tier

- **Public packages**: Unlimited
- **Private packages**: 500MB storage
- **Bandwidth**: 1GB/month for private packages

### Paid Plans

- **GitHub Pro**: 2GB private storage
- **GitHub Team**: 2GB private storage
- **GitHub Enterprise**: 50GB private storage

### Monitoring Usage

```bash
# Check package usage
gh api user/packages

# View billing information
gh api billing/quota
```

## Integration Examples

### Kubernetes Deployment

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
        image: ghcr.io/your-username/discordbot:latest
        ports:
        - containerPort: 3001
        env:
        - name: DISCORD_TOKEN
          valueFrom:
            secretKeyRef:
              name: discord-secrets
              key: token
```

### Docker Swarm

```yaml
version: '3.8'
services:
  discordbot:
    image: ghcr.io/your-username/discordbot:latest
    ports:
      - "3001:3001"
    environment:
      - DISCORD_TOKEN=${DISCORD_TOKEN}
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
```

This setup provides a complete container registry solution with automated builds, security scanning, and easy deployment options. 