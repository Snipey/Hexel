import { FastifyInstance } from 'fastify';
import { databaseManager } from '../utils/database';

export async function healthRoutes(fastify: FastifyInstance) {
  // Health check endpoint
  fastify.get('/health', async (request, reply) => {
    try {
      // Check database connection
      const dbStatus = databaseManager.getStatus();
      
      const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: {
          type: dbStatus.type,
          connected: dbStatus.connected,
          url: dbStatus.url
        },
        memory: {
          used: process.memoryUsage().heapUsed,
          total: process.memoryUsage().heapTotal,
          external: process.memoryUsage().external
        },
        version: process.env.npm_package_version || '1.0.0'
      };

      // If database is not connected, mark as unhealthy
      if (!dbStatus.connected) {
        healthStatus.status = 'unhealthy';
        return reply.status(503).send(healthStatus);
      }

      return reply.send(healthStatus);
    } catch (error) {
      const errorStatus = {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        uptime: process.uptime()
      };

      return reply.status(503).send(errorStatus);
    }
  });

  // Readiness check endpoint
  fastify.get('/ready', async (request, reply) => {
    try {
      // Check if the application is ready to serve requests
      const dbStatus = databaseManager.getStatus();
      
      if (!dbStatus.connected) {
        return reply.status(503).send({
          status: 'not ready',
          reason: 'Database not connected',
          timestamp: new Date().toISOString()
        });
      }

      return reply.send({
        status: 'ready',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      return reply.status(503).send({
        status: 'not ready',
        reason: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Liveness check endpoint
  fastify.get('/live', async (request, reply) => {
    // Simple liveness check - just check if the process is running
    return reply.send({
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });
} 