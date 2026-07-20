import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { db } from '../database/connection.js';
import { files, documentChunks } from '../database/schema.js';
import { and, eq, inArray } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

const SuggestedQuestionsRequestSchema = z.object({
  documentIds: z.array(z.string()).optional(),
  limit: z.number().min(1).max(10).default(3),
});

export async function ragSuggestionsRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  
  // Get suggested questions based on documents
  fastify.post('/suggested-questions', {
    schema: {
      description: 'Get suggested questions based on knowledge base documents',
      tags: ['rag'],
      body: {
        type: 'object',
        properties: {
          documentIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional array of document IDs to analyze'
          },
          limit: {
            type: 'number',
            default: 3,
            minimum: 1,
            maximum: 10
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            questions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  question: { type: 'string' },
                  category: { type: 'string' },
                  relevance: { type: 'string' },
                  icon: { type: 'string' }
                }
              }
            },
            totalDocuments: { type: 'number' },
            documentsAnalyzed: { type: 'array', items: { type: 'string' } }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { documentIds, limit } = SuggestedQuestionsRequestSchema.parse(request.body);
      
      logger.info(`Generating suggested questions (limit: ${limit}, documentIds: ${documentIds?.length || 'all'})`);

      // Get files (either specific ones or all)
      let query = db.select().from(files).where(eq(files.status, 'processed'));
      
      if (documentIds && documentIds.length > 0) {
        query = db
          .select()
          .from(files)
          .where(and(inArray(files.id, documentIds), eq(files.status, 'processed')));
      }

      const processedFiles = await query.limit(50); // Limit to 50 files for performance
      
      if (processedFiles.length === 0) {
        return reply.send({
          questions: [
            {
              question: "How do I upload documents to the knowledge base?",
              category: "Getting Started",
              relevance: "Essential for first-time users",
              icon: "📁"
            },
            {
              question: "What file types are supported?",
              category: "Documentation",
              relevance: "Understanding file compatibility",
              icon: "📄"
            },
            {
              question: "How does the semantic search work?",
              category: "Features",
              relevance: "Understanding RAG capabilities",
              icon: "🔍"
            }
          ],
          totalDocuments: 0,
          documentsAnalyzed: []
        });
      }

      // Analyze filenames to generate relevant questions
      const questions = generateQuestionsFromDocuments(processedFiles, limit);

      reply.send({
        questions,
        totalDocuments: processedFiles.length,
        documentsAnalyzed: processedFiles.map(f => f.filename)
      });

    } catch (error) {
      logger.error('Failed to generate suggested questions:', error);
      reply.status(500).send({
        error: 'Failed to generate suggested questions',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}

// Generate intelligent questions based on document filenames and patterns
function generateQuestionsFromDocuments(files: any[], limit: number): Array<{
  question: string;
  category: string;
  relevance: string;
  icon: string;
}> {
  const questions: Array<{
    question: string;
    category: string;
    relevance: string;
    icon: string;
    score: number;
  }> = [];

  // Analyze filenames for topics
  const topics = new Set<string>();
  const hasBackend = files.some(f => f.filename.toLowerCase().includes('backend'));
  const hasFrontend = files.some(f => f.filename.toLowerCase().includes('frontend'));
  const hasRAG = files.some(f => f.filename.toLowerCase().includes('rag'));
  const hasDeployment = files.some(f => f.filename.toLowerCase().includes('deploy'));
  const hasTesting = files.some(f => f.filename.toLowerCase().includes('test'));
  const hasTroubleshooting = files.some(f => f.filename.toLowerCase().includes('troubleshoot'));
  const hasQuickstart = files.some(f => f.filename.toLowerCase().includes('quickstart') || f.filename.toLowerCase().includes('getting'));
  const hasSetup = files.some(f => f.filename.toLowerCase().includes('setup') || f.filename.toLowerCase().includes('install'));
  const hasAPI = files.some(f => f.filename.toLowerCase().includes('api'));
  const hasDatabase = files.some(f => f.filename.toLowerCase().includes('database') || f.filename.toLowerCase().includes('db'));
  const hasAuthentication = files.some(f => f.filename.toLowerCase().includes('auth') || f.filename.toLowerCase().includes('oauth'));

  // Backend questions
  if (hasBackend) {
    questions.push({
      question: "How do I set up the backend environment?",
      category: "Backend Development",
      relevance: "Essential for backend setup",
      icon: "⚙️",
      score: 10
    });
    questions.push({
      question: "What are the backend API endpoints available?",
      category: "Backend Development",
      relevance: "Understanding API structure",
      icon: "🔌",
      score: 9
    });
    questions.push({
      question: "How is the backend service architecture designed?",
      category: "Backend Development",
      relevance: "Understanding system architecture",
      icon: "🏗️",
      score: 8
    });
  }

  // Frontend questions
  if (hasFrontend) {
    questions.push({
      question: "How do I set up the frontend development environment?",
      category: "Frontend Development",
      relevance: "Essential for frontend setup",
      icon: "💻",
      score: 10
    });
    questions.push({
      question: "What React components are available?",
      category: "Frontend Development",
      relevance: "Understanding UI components",
      icon: "⚛️",
      score: 9
    });
    questions.push({
      question: "How does the frontend integrate with the backend?",
      category: "Frontend Development",
      relevance: "Understanding data flow",
      icon: "🔗",
      score: 8
    });
  }

  // RAG questions
  if (hasRAG) {
    questions.push({
      question: "How does the RAG system work?",
      category: "RAG & AI",
      relevance: "Understanding core RAG functionality",
      icon: "🤖",
      score: 10
    });
    questions.push({
      question: "How are embeddings generated for documents?",
      category: "RAG & AI",
      relevance: "Understanding document indexing",
      icon: "🧠",
      score: 9
    });
    questions.push({
      question: "What is semantic search and how does it work?",
      category: "RAG & AI",
      relevance: "Understanding search capabilities",
      icon: "🔍",
      score: 9
    });
  }

  // Setup/Installation questions
  if (hasSetup || hasQuickstart) {
    questions.push({
      question: "What are the installation requirements?",
      category: "Getting Started",
      relevance: "Essential for initial setup",
      icon: "📦",
      score: 10
    });
    questions.push({
      question: "How do I configure the environment variables?",
      category: "Getting Started",
      relevance: "Required for proper configuration",
      icon: "🔧",
      score: 9
    });
  }

  // Deployment questions
  if (hasDeployment) {
    questions.push({
      question: "How do I deploy the application to production?",
      category: "Deployment",
      relevance: "Essential for going live",
      icon: "🚀",
      score: 10
    });
    questions.push({
      question: "What are the deployment best practices?",
      category: "Deployment",
      relevance: "Ensuring reliable deployments",
      icon: "✅",
      score: 8
    });
  }

  // Testing questions
  if (hasTesting) {
    questions.push({
      question: "How do I run the test suite?",
      category: "Testing",
      relevance: "Ensuring code quality",
      icon: "🧪",
      score: 8
    });
    questions.push({
      question: "What testing strategies are recommended?",
      category: "Testing",
      relevance: "Best practices for testing",
      icon: "✔️",
      score: 7
    });
  }

  // Troubleshooting questions
  if (hasTroubleshooting) {
    questions.push({
      question: "What are common issues and how do I fix them?",
      category: "Troubleshooting",
      relevance: "Resolving problems quickly",
      icon: "🔧",
      score: 9
    });
    questions.push({
      question: "How do I debug connection errors?",
      category: "Troubleshooting",
      relevance: "Common technical issue",
      icon: "🐛",
      score: 8
    });
  }

  // Database questions
  if (hasDatabase) {
    questions.push({
      question: "How do I set up the database?",
      category: "Database",
      relevance: "Essential for data storage",
      icon: "🗄️",
      score: 9
    });
    questions.push({
      question: "How do I run database migrations?",
      category: "Database",
      relevance: "Managing schema changes",
      icon: "📊",
      score: 8
    });
  }

  // Authentication questions
  if (hasAuthentication) {
    questions.push({
      question: "How does authentication work?",
      category: "Security",
      relevance: "Understanding user authentication",
      icon: "🔐",
      score: 9
    });
    questions.push({
      question: "How do I configure OAuth providers?",
      category: "Security",
      relevance: "Setting up third-party auth",
      icon: "🔑",
      score: 8
    });
  }

  // API questions
  if (hasAPI) {
    questions.push({
      question: "What API endpoints are available?",
      category: "API",
      relevance: "Understanding API capabilities",
      icon: "🔌",
      score: 8
    });
  }

  // Fallback questions if no specific topics detected
  if (questions.length === 0) {
    questions.push(
      {
        question: "What does this documentation cover?",
        category: "General",
        relevance: "Understanding available documentation",
        icon: "📚",
        score: 5
      },
      {
        question: "What are the main features?",
        category: "General",
        relevance: "Overview of capabilities",
        icon: "⭐",
        score: 5
      },
      {
        question: "How do I get started?",
        category: "General",
        relevance: "First steps",
        icon: "🚀",
        score: 5
      }
    );
  }

  // Sort by score and return top N
  return questions
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ question, category, relevance, icon }) => ({ question, category, relevance, icon }));
}


