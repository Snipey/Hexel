# Security Setup Guide

## Overview

The Discord bot now uses a secure Fastify API with comprehensive security features:

- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: Prevents abuse with configurable limits
- **CORS Protection**: Controlled cross-origin requests
- **Helmet Security**: HTTP security headers
- **Request Validation**: Zod schema validation
- **OpenAPI Documentation**: Auto-generated API docs

## Environment Variables

Add these to your `.env` file:

```env
# Discord Bot Configuration
DISCORD_TOKEN=your_discord_bot_token_here
CLIENT_ID=your_discord_client_id_here
GUILD_ID=your_discord_guild_id_here

# Database
DATABASE_URL="file:./dev.db"

# API Security
JWT_SECRET=your-super-secret-jwt-key-change-in-production
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Optional: Custom API Port
API_PORT=4000
```

## Security Features

### 1. JWT Authentication
- All API endpoints (except `/auth/login` and `/docs`) require JWT authentication
- Tokens expire after 24 hours
- Include token in Authorization header: `Bearer <token>`

### 2. Rate Limiting
- 100 requests per minute per IP
- Configurable limits in `src/bot/api.ts`

### 3. CORS Protection
- Only allows requests from specified origins
- Configure via `ALLOWED_ORIGINS` environment variable

### 4. Request Validation
- All requests validated with Zod schemas
- Automatic error responses for invalid data

### 5. Security Headers
- Helmet.js provides comprehensive HTTP security headers
- Content Security Policy (CSP) configured

## API Endpoints

### Authentication
- `POST /auth/login` - Login and get JWT token
- `GET /health` - Health check (no auth required)

### Projects
- `GET /projects` - List all projects (requires auth)
- `GET /projects/:id` - Get specific project (requires auth)
- `PATCH /projects/:id` - Update project (requires auth)

### Resources
- `POST /projects/:id/resources` - Add resource to project (requires auth)
- `GET /resources/:id` - Get specific resource (requires auth)
- `PATCH /resources/:id` - Update resource (requires auth)
- `POST /resources/:id/complete` - Complete resource (requires auth)
- `DELETE /resources/:id` - Delete resource (requires auth)

## API Documentation

Visit `http://localhost:4000/docs` for interactive API documentation.

## Dashboard Integration

The Next.js dashboard has been updated to:
- Handle JWT authentication
- Store tokens in localStorage
- Automatically refresh on token expiration
- Display user information
- Provide login/logout functionality

## Demo Credentials

For testing purposes, the API accepts any username/password combination.

## Production Considerations

1. **Change JWT Secret**: Use a strong, random secret in production
2. **HTTPS**: Always use HTTPS in production
3. **Environment Variables**: Never commit secrets to version control
4. **Rate Limiting**: Adjust limits based on your needs
5. **CORS**: Restrict origins to your actual domains
6. **Database**: Use a production database (PostgreSQL, MySQL, etc.)
7. **Logging**: Configure proper logging for security monitoring

## Security Best Practices

1. **Regular Updates**: Keep dependencies updated
2. **Monitoring**: Monitor API usage and errors
3. **Backup**: Regular database backups
4. **Access Control**: Implement proper user roles if needed
5. **Audit Logs**: Log authentication and authorization events 