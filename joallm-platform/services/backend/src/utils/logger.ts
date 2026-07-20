import winston from 'winston';
import { config } from '../config/config.js';

// Custom log levels and colors
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
  verbose: 5,
};

const logColors: { [key: string]: string } = {
  error: 'red',
  warn: 'yellow',
  info: 'cyan',
  http: 'magenta',
  debug: 'green',
  verbose: 'blue',
};

winston.addColors(logColors);

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta, null, 2)}`;
    }
    return log;
  })
);

// Create transports
const transports: winston.transport[] = [
  new winston.transports.Console({
    format: config.nodeEnv === 'development' ? devFormat : logFormat,
  }),
];

// Add file transports for production
if (config.nodeEnv === 'production') {
  transports.push(
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

export const logger = winston.createLogger({
  levels: logLevels,
  level: config.logLevel,
  format: logFormat,
  defaultMeta: { 
    service: 'joallm-api',
    env: config.nodeEnv,
  },
  transports,
  // Don't exit on handled exceptions
  exitOnError: false,
});

// Request logging helper
export const logRequest = (req: any, res: any, duration: number) => {
  const logData = {
    method: req.method,
    url: req.url,
    statusCode: res.statusCode,
    duration: `${duration}ms`,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    userId: req.user?.id,
  };

  if (res.statusCode >= 500) {
    logger.error('Request failed', logData);
  } else if (res.statusCode >= 400) {
    logger.warn('Request warning', logData);
  } else {
    logger.http('Request', logData);
  }
};

// Performance logging helper
export const logPerformance = (operation: string, duration: number, metadata?: any) => {
  const logLevel = duration > 1000 ? 'warn' : 'info';
  logger.log(logLevel, `Performance: ${operation}`, {
    operation,
    duration: `${duration}ms`,
    ...metadata,
  });
};

// Error logging with context
export const logError = (error: Error, context?: any) => {
  logger.error('Error occurred', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    context,
  });
};

// Create logs directory if it doesn't exist
if (config.nodeEnv === 'production') {
  import('fs').then((fs) => {
    if (!fs.existsSync('logs')) {
      fs.mkdirSync('logs', { recursive: true });
    }
  });
}


