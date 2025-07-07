import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { z } from 'zod';

const prisma = new PrismaClient();

// JWT Secret - In production, use environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Validation schemas
const ResourceSchema = z.object({
  resource: z.string().min(1, 'Resource name is required'),
  amount: z.number().positive('Amount must be positive'),
  type: z.string().optional(),
});

const ResourceUpdateSchema = z.object({
  amount: z.number().positive().optional(),
  type: z.string().optional(),
  progress: z.number().min(0).max(100).optional(),
});

const ProjectUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  deadline: z.string().datetime().optional(),
});

// JWT Authentication decorator
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      username: string;
    };
  }
}

async function createServer(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
        },
      },
    },
    trustProxy: true, // Trust proxy headers for rate limiting
  });

  // Security plugins
  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  });

  await fastify.register(cors, {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });

  await fastify.register(rateLimit, {
    max: 100, // Maximum 100 requests
    timeWindow: '1 minute', // Per minute
    errorResponseBuilder: (req, context) => ({
      code: 429,
      error: 'Too Many Requests',
      message: `Rate limit exceeded, retry in ${context.after}`,
      retryAfter: context.after,
    }),
  });

  // JWT Authentication
  await fastify.register(jwt, {
    secret: JWT_SECRET,
    sign: {
      expiresIn: '24h',
    },
  });

  // Authentication hook
  fastify.addHook('preHandler', async (request, reply) => {
    try {
      if (request.url.startsWith('/auth') || request.url.startsWith('/docs')) {
        return; // Skip auth for auth endpoints and docs
      }
      
      const token = request.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return reply.status(401).send({ error: 'No token provided' });
      }

      const decoded = await request.jwtVerify(token);
      request.user = decoded as any;
    } catch (err) {
      return reply.status(401).send({ error: 'Invalid token' });
    }
  });

  // Swagger documentation
  await fastify.register(swagger, {
    swagger: {
      info: {
        title: 'Discord Bot API',
        description: 'API for managing Discord bot projects and resources',
        version: '1.0.0',
      },
      host: 'localhost:4000',
      schemes: ['http'],
      consumes: ['application/json'],
      produces: ['application/json'],
      securityDefinitions: {
        bearerAuth: {
          type: 'apiKey',
          name: 'Authorization',
          in: 'header',
          description: 'JWT token in format: Bearer <token>',
        },
      },
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  });

  // Authentication routes
  fastify.post('/auth/login', {
    schema: {
      body: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string' },
          password: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            token: { type: 'string' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                username: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { username, password } = request.body as any;
    
    // In a real app, validate against database
    // For demo purposes, accept any credentials
    if (username && password) {
      const token = await reply.jwtSign({ id: '1', username });
      return { token, user: { id: '1', username } };
    }
    
    return reply.status(401).send({ error: 'Invalid credentials' });
  });

  // Health check
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // List all projects with resources
  fastify.get('/projects', {
    schema: {
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              name: { type: 'string' },
              deadline: { type: 'string', format: 'date-time' },
              resources: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'number' },
                    resource: { type: 'string' },
                    amount: { type: 'number' },
                    type: { type: 'string' },
                    progress: { type: 'number' },
                    completed: { type: 'boolean' },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const projects = await prisma.project.findMany({ 
        include: { resources: true },
        orderBy: { createdAt: 'desc' }
      });
      return projects;
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get a single project by ID
  fastify.get('/projects/:id', {
    schema: {
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', pattern: '^\\d+$' },
        },
        required: ['id'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            name: { type: 'string' },
            deadline: { type: 'string', format: 'date-time' },
            resources: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'number' },
                  resource: { type: 'string' },
                  amount: { type: 'number' },
                  type: { type: 'string' },
                  progress: { type: 'number' },
                  completed: { type: 'boolean' },
                },
              },
            },
          },
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const project = await prisma.project.findUnique({
        where: { id: Number(id) },
        include: { resources: true }
      });
      
      if (!project) {
        return reply.status(404).send({ error: 'Project not found' });
      }
      
      return project;
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Add a resource to a project
  fastify.post('/projects/:id/resources', {
    schema: {
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', pattern: '^\\d+$' },
        },
        required: ['id'],
      },
      body: ResourceSchema,
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            projectId: { type: 'number' },
            resource: { type: 'string' },
            amount: { type: 'number' },
            type: { type: 'string' },
            progress: { type: 'number' },
            completed: { type: 'boolean' },
          },
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const body = request.body as any;

      // Validate project exists
      const project = await prisma.project.findUnique({
        where: { id: Number(id) }
      });
      
      if (!project) {
        return reply.status(404).send({ error: 'Project not found' });
      }

      const newResource = await prisma.resource.create({
        data: {
          projectId: Number(id),
          resource: body.resource,
          amount: body.amount,
          type: body.type || null,
          progress: 0,
        }
      });
      
      return reply.status(201).send(newResource);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get a single resource by ID
  fastify.get('/resources/:id', {
    schema: {
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', pattern: '^\\d+$' },
        },
        required: ['id'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            projectId: { type: 'number' },
            resource: { type: 'string' },
            amount: { type: 'number' },
            type: { type: 'string' },
            progress: { type: 'number' },
            completed: { type: 'boolean' },
          },
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const resource = await prisma.resource.findUnique({ 
        where: { id: Number(id) } 
      });
      
      if (!resource) {
        return reply.status(404).send({ error: 'Resource not found' });
      }
      
      return resource;
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Edit a resource
  fastify.patch('/resources/:id', {
    schema: {
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', pattern: '^\\d+$' },
        },
        required: ['id'],
      },
      body: ResourceUpdateSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            projectId: { type: 'number' },
            resource: { type: 'string' },
            amount: { type: 'number' },
            type: { type: 'string' },
            progress: { type: 'number' },
            completed: { type: 'boolean' },
          },
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const body = request.body as any;
      
      const data: any = {};
      if (body.amount !== undefined) data.amount = body.amount;
      if (body.type !== undefined) data.type = body.type;
      if (body.progress !== undefined) data.progress = body.progress;
      
      const updated = await prisma.resource.update({ 
        where: { id: Number(id) }, 
        data 
      });
      
      return updated;
    } catch (error) {
      request.log.error(error);
      if (error.code === 'P2025') {
        return reply.status(404).send({ error: 'Resource not found' });
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Complete a resource
  fastify.post('/resources/:id/complete', {
    schema: {
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', pattern: '^\\d+$' },
        },
        required: ['id'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            projectId: { type: 'number' },
            resource: { type: 'string' },
            amount: { type: 'number' },
            type: { type: 'string' },
            progress: { type: 'number' },
            completed: { type: 'boolean' },
          },
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const updated = await prisma.resource.update({ 
        where: { id: Number(id) }, 
        data: { completed: true, progress: 100 } 
      });
      
      return updated;
    } catch (error) {
      request.log.error(error);
      if (error.code === 'P2025') {
        return reply.status(404).send({ error: 'Resource not found' });
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Delete a resource
  fastify.delete('/resources/:id', {
    schema: {
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', pattern: '^\\d+$' },
        },
        required: ['id'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
          },
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      await prisma.resource.delete({ where: { id: Number(id) } });
      return { success: true };
    } catch (error) {
      request.log.error(error);
      if (error.code === 'P2025') {
        return reply.status(404).send({ error: 'Resource not found' });
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update a project
  fastify.patch('/projects/:id', {
    schema: {
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', pattern: '^\\d+$' },
        },
        required: ['id'],
      },
      body: ProjectUpdateSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            name: { type: 'string' },
            deadline: { type: 'string', format: 'date-time' },
          },
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const body = request.body as any;
      
      const data: any = {};
      if (body.name !== undefined) data.name = body.name;
      if (body.deadline !== undefined) data.deadline = new Date(body.deadline);
      
      const updated = await prisma.project.update({ 
        where: { id: Number(id) }, 
        data 
      });
      
      return updated;
    } catch (error) {
      request.log.error(error);
      if (error.code === 'P2025') {
        return reply.status(404).send({ error: 'Project not found' });
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  return fastify;
}

// Start the server
async function startServer() {
  try {
    const server = await createServer();
    await server.listen({ port: 4000, host: '0.0.0.0' });
    console.log('Secure Bot API listening on http://localhost:4000');
    console.log('API Documentation available at http://localhost:4000/docs');
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
}

// Export for use in other modules
export { createServer, startServer }; 