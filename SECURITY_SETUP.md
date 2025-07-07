# Security Setup Guide

This guide covers security best practices for running the Discord bot in production.

## Environment Variables

### Required Variables
Add these to your `.env` file:

```env
# Discord Bot Configuration
BOT_TOKEN=your_discord_bot_token_here
CLIENT_ID=your_discord_client_id_here
GUILD_ID=your_discord_guild_id_here

# Logging
LOG_LEVEL=info
```

### Security Best Practices

1. **Never commit `.env` files** - They're already in `.gitignore`
2. **Use strong, unique tokens** - Generate new tokens for each environment
3. **Rotate tokens regularly** - Change Discord bot tokens periodically
4. **Use environment-specific configs** - Different tokens for dev/staging/prod

## Discord Bot Security

### Bot Permissions
Only grant the minimum required permissions:
- Send Messages
- Embed Links
- Read Message History
- Use Slash Commands
- View Channels

### Token Security
- Store tokens securely (environment variables, secret managers)
- Never log or expose tokens in code
- Use different tokens for development and production

## Production Deployment

### Docker Security
- Run containers as non-root user
- Use multi-stage builds to minimize attack surface
- Keep base images updated
- Scan images for vulnerabilities

### Network Security
- Use HTTPS in production
- Configure proper firewall rules
- Limit container network access

## Monitoring and Logging

### Log Management
- Configure appropriate log levels
- Rotate log files regularly
- Monitor for suspicious activity
- Use structured logging

### Health Checks
- Implement health check endpoints
- Monitor bot uptime and performance
- Set up alerts for failures

## Updates and Maintenance

### Regular Updates
- Keep dependencies updated
- Monitor security advisories
- Test updates in staging first
- Have rollback procedures ready

### Backup Strategy
- Regular backups of configuration
- Version control for all changes
- Document deployment procedures 