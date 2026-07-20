import { FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
      role: string;
    };
    startTime?: number;
    correlationId?: string;
  }
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: "user" | "admin";
}

export interface AuthenticatedRequest extends FastifyRequest {
  user: AuthenticatedUser;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}
