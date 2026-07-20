// Performance optimization configurations for JoaLLM platform

const optimizationConfig = {
  // Node.js optimizations
  node: {
    // Enable V8 optimizations
    v8: {
      '--max-old-space-size': '4096', // 4GB heap
      '--optimize-for-size': true,
      '--gc-interval': '100',
      '--expose-gc': true
    },
    
    // Cluster mode for multi-core utilization
    cluster: {
      enabled: true,
      workers: 'auto', // Will use CPU cores count
      respawn: true,
      respawnDelay: 1000
    },
    
    // Memory management
    memory: {
      maxHeapUsed: '3GB',
      gcThreshold: 0.8,
      leakDetection: true
    }
  },

  // Database optimizations
  database: {
    postgres: {
      // Connection pool settings
      pool: {
        min: 5,
        max: 20,
        acquireTimeoutMillis: 30000,
        createTimeoutMillis: 30000,
        destroyTimeoutMillis: 5000,
        idleTimeoutMillis: 30000,
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 200
      },
      
      // Query optimizations
      query: {
        statement_timeout: 30000,
        query_timeout: 30000,
        connectionTimeoutMillis: 10000
      },
      
      // Indexing recommendations
      indexes: [
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users(email);',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_user_id ON chat_sessions(user_id);',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_session_id ON chat_messages(session_id);',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_user_id ON documents(user_id);',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_embeddings_document_id ON embeddings(document_id);'
      ]
    },
    
    redis: {
      // Connection pool
      pool: {
        min: 5,
        max: 20,
        acquireTimeoutMillis: 30000,
        createTimeoutMillis: 30000,
        destroyTimeoutMillis: 5000,
        idleTimeoutMillis: 30000
      },
      
      // Memory optimization
      memory: {
        maxmemory: '2gb',
        maxmemoryPolicy: 'allkeys-lru',
        save: '900 1 300 10 60 10000'
      },
      
      // Performance settings
      performance: {
        tcpKeepalive: true,
        lazyConnect: true,
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100
      }
    }
  },

  // API Gateway optimizations
  apiGateway: {
    // Rate limiting
    rateLimit: {
      max: 1000,
      timeWindow: '1 minute',
      skipOnError: false,
      keyGenerator: (request) => request.ip
    },
    
    // Compression
    compression: {
      enabled: true,
      threshold: 1024,
      level: 6
    },
    
    // Caching
    cache: {
      enabled: true,
      ttl: 300, // 5 minutes
      max: 1000
    },
    
    // Request/Response optimization
    optimization: {
      bodyLimit: '10mb',
      keepAliveTimeout: 65000,
      headersTimeout: 66000,
      requestTimeout: 30000
    }
  },

  // Service-specific optimizations
  services: {
    auth: {
      // JWT optimization
      jwt: {
        algorithm: 'HS256',
        expiresIn: '15m',
        refreshExpiresIn: '7d',
        issuer: 'joallm-platform'
      },
      
      // Password hashing
      bcrypt: {
        rounds: 12,
        saltRounds: 12
      }
    },
    
    chat: {
      // LLM API optimization
      llm: {
        timeout: 30000,
        maxRetries: 3,
        retryDelay: 1000,
        concurrency: 5
      },
      
      // Message processing
      processing: {
        batchSize: 10,
        maxConcurrent: 5,
        queueSize: 1000
      }
    },
    
    rag: {
      // Vector search optimization
      vectorSearch: {
        batchSize: 100,
        maxResults: 10,
        similarityThreshold: 0.7
      },
      
      // Document processing
      documentProcessing: {
        chunkSize: 1000,
        overlap: 200,
        maxConcurrent: 3
      }
    }
  },

  // Monitoring and alerting
  monitoring: {
    // Metrics collection
    metrics: {
      enabled: true,
      interval: 10000, // 10 seconds
      retention: '7d'
    },
    
    // Health checks
    healthChecks: {
      interval: 30000, // 30 seconds
      timeout: 5000,
      retries: 3
    },
    
    // Alerting thresholds
    alerts: {
      errorRate: 0.05, // 5%
      responseTime: 1000, // 1 second
      memoryUsage: 0.8, // 80%
      cpuUsage: 0.8 // 80%
    }
  },

  // Caching strategies
  caching: {
    // Redis caching
    redis: {
      userSessions: { ttl: 3600 }, // 1 hour
      chatHistory: { ttl: 86400 }, // 24 hours
      documents: { ttl: 1800 }, // 30 minutes
      embeddings: { ttl: 3600 } // 1 hour
    },
    
    // In-memory caching
    memory: {
      enabled: true,
      maxSize: '100MB',
      ttl: 300 // 5 minutes
    }
  },

  // Security optimizations
  security: {
    // CORS
    cors: {
      origin: ['http://localhost:5173', 'http://localhost:3000'],
      credentials: true,
      maxAge: 86400
    },
    
    // Helmet security headers
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"]
        }
      }
    }
  }
};

// Performance testing scenarios
const performanceScenarios = {
  // Load testing scenarios
  load: {
    light: {
      users: 10,
      duration: '5m',
      rampUp: '1m'
    },
    medium: {
      users: 50,
      duration: '10m',
      rampUp: '2m'
    },
    heavy: {
      users: 100,
      duration: '15m',
      rampUp: '3m'
    }
  },
  
  // Stress testing scenarios
  stress: {
    gradual: {
      users: 200,
      duration: '20m',
      rampUp: '5m'
    },
    spike: {
      users: 500,
      duration: '5m',
      rampUp: '30s'
    }
  },
  
  // Endurance testing scenarios
  endurance: {
    sustained: {
      users: 25,
      duration: '2h',
      rampUp: '5m'
    }
  }
};

// Performance benchmarks
const benchmarks = {
  responseTime: {
    excellent: 100, // ms
    good: 300,
    acceptable: 1000,
    poor: 3000
  },
  
  throughput: {
    excellent: 1000, // req/sec
    good: 500,
    acceptable: 100,
    poor: 10
  },
  
  errorRate: {
    excellent: 0.001, // 0.1%
    good: 0.01, // 1%
    acceptable: 0.05, // 5%
    poor: 0.1 // 10%
  },
  
  availability: {
    excellent: 0.9999, // 99.99%
    good: 0.999, // 99.9%
    acceptable: 0.99, // 99%
    poor: 0.95 // 95%
  }
};

module.exports = {
  optimizationConfig,
  performanceScenarios,
  benchmarks
};






