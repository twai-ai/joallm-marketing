// User-friendly error messages dictionary
// Provides consistent, actionable error messages across the application

export interface UserErrorMessage {
  title: string;
  message: string | ((...args: any[]) => string);
  action?: string;
  docLink?: string;
}

export const USER_ERRORS: Record<string, UserErrorMessage> = {
  UNSUPPORTED_FORMAT: {
    title: 'File type not supported',
    message: (filename: string, format: string) => 
      `${filename} (${format}) isn't supported yet.`,
    action: 'Try converting to .docx or .txt format',
    docLink: '/docs/supported-formats'
  },
  
  COMING_SOON_FORMAT: {
    title: 'Format in development',
    message: (filename: string, format: string) => 
      `${filename} (${format}) support is coming soon! This format is actively being developed.`,
    action: 'Convert to a supported format like .docx, .txt, or .md, or check back later',
    docLink: '/docs/supported-formats'
  },
  
  BETA_FORMAT_WARNING: {
    title: 'Limited support',
    message: (filename: string) => 
      `${filename} uploaded successfully, but text extraction is in beta. Search results may be incomplete.`,
    action: 'For best results, consider converting to .docx or .txt',
  },
  
  FILE_TOO_LARGE: {
    title: 'File too large',
    message: (filename: string, size: string, limit: string) => 
      `${filename} (${size}) exceeds the ${limit} limit.`,
    action: 'Try compressing the file or splitting it into smaller parts'
  },
  
  FILE_EMPTY: {
    title: 'Empty file',
    message: (filename: string) => 
      `${filename} appears to be empty (0 bytes).`,
    action: 'Check the file and try uploading again'
  },
  
  INVALID_FILENAME: {
    title: 'Invalid filename',
    message: (filename: string) => 
      `"${filename}" contains invalid characters.`,
    action: 'Rename the file to remove special characters like < > : " / \\ | ? *'
  },
  
  FILENAME_TOO_LONG: {
    title: 'Filename too long',
    message: (filename: string) => 
      `"${filename}" is too long (max 255 characters).`,
    action: 'Rename the file to be shorter'
  },
  
  NETWORK_ERROR: {
    title: 'Upload failed',
    message: 'Network connection issue. Please try again.',
    action: 'Check your internet connection and retry'
  },
  
  SERVER_ERROR: {
    title: 'Server error',
    message: 'The server encountered an error processing your file.',
    action: 'Try again in a few moments. If the problem persists, contact support.'
  },
  
  PROCESSING_FAILED: {
    title: 'Processing failed',
    message: (filename: string) => 
      `Failed to process ${filename}. The file may be corrupted or in an unsupported format variant.`,
    action: 'Try re-saving the file or converting it to a different format'
  },
  
  EXTRACTION_FAILED: {
    title: 'Content extraction failed',
    message: (filename: string) => 
      `Uploaded ${filename} successfully, but couldn't extract text content.`,
    action: 'Try opening the file, selecting all text, and saving as .txt'
  },
  
  TOO_MANY_FILES: {
    title: 'Too many files',
    message: (count: number, maxFiles: number) => 
      `You selected ${count} files, but the maximum is ${maxFiles} at a time.`,
    action: 'Select fewer files and upload in batches'
  },
  
  AUTHENTICATION_REQUIRED: {
    title: 'Please sign in',
    message: 'You need to be signed in to upload files.',
    action: 'Sign in to your account to continue'
  },
  
  QUOTA_EXCEEDED: {
    title: 'Storage quota exceeded',
    message: 'You\'ve reached your storage limit.',
    action: 'Delete some files or upgrade your plan'
  },
  
  FILE_ALREADY_EXISTS: {
    title: 'File already exists',
    message: (filename: string) => 
      `A file named "${filename}" already exists.`,
    action: 'Rename the file or delete the existing one first'
  },
  
  INDEXING_IN_PROGRESS: {
    title: 'Indexing in progress',
    message: (filename: string) => 
      `${filename} is still being indexed for search.`,
    action: 'Wait a moment for indexing to complete before searching'
  },
  
  BULK_UPLOAD_PARTIAL_FAILURE: {
    title: 'Some files failed',
    message: (successful: number, failed: number, total: number) => 
      `${successful} of ${total} files uploaded successfully. ${failed} failed.`,
    action: 'Review the failed files and try uploading them again'
  },
};

/**
 * Format an error message with the provided parameters
 */
export function formatError(
  errorKey: keyof typeof USER_ERRORS,
  ...args: any[]
): { title: string; message: string; action?: string; docLink?: string } {
  const error = USER_ERRORS[errorKey];
  
  if (!error) {
    return {
      title: 'Error',
      message: 'An unexpected error occurred',
      action: 'Please try again'
    };
  }
  
  const message = typeof error.message === 'function' 
    ? error.message(...args)
    : error.message;
  
  return {
    title: error.title,
    message,
    action: error.action,
    docLink: error.docLink
  };
}

/**
 * Get error message from backend error response
 */
export function parseBackendError(error: any): { title: string; message: string; action?: string } {
  // Handle different error response formats
  if (error?.response?.data?.message) {
    return {
      title: 'Upload Error',
      message: error.response.data.message,
      action: 'Please try again or contact support if the issue persists'
    };
  }
  
  if (error?.message) {
    // Map common error messages to user-friendly ones
    if (error.message.includes('Network Error') || error.message.includes('Failed to fetch')) {
      return formatError('NETWORK_ERROR');
    }
    
    if (error.message.includes('413') || error.message.includes('too large')) {
      return formatError('FILE_TOO_LARGE', 'File', 'unknown', '50MB');
    }
    
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      return formatError('AUTHENTICATION_REQUIRED');
    }
    
    if (error.message.includes('500') || error.message.includes('Internal Server Error')) {
      return formatError('SERVER_ERROR');
    }
    
    return {
      title: 'Error',
      message: error.message,
      action: 'Please try again'
    };
  }
  
  return formatError('SERVER_ERROR');
}

/**
 * Create a detailed error message for file validation
 */
export function createFileValidationError(
  file: File,
  validationResult: { status: string; errors: string[]; warnings: string[] }
): { title: string; message: string; action?: string; docLink?: string } {
  const { status, errors, warnings } = validationResult;
  
  if (status === 'coming-soon') {
    const ext = file.name.split('.').pop() || 'unknown';
    return formatError('COMING_SOON_FORMAT', file.name, `.${ext}`);
  }
  
  if (status === 'unsupported') {
    const ext = file.name.split('.').pop() || 'unknown';
    return formatError('UNSUPPORTED_FORMAT', file.name, `.${ext}`);
  }
  
  if (errors.length > 0) {
    if (errors[0].includes('too large') || errors[0].includes('exceeds')) {
      const size = `${(file.size / (1024 * 1024)).toFixed(1)}MB`;
      return formatError('FILE_TOO_LARGE', file.name, size, '50MB');
    }
    
    if (errors[0].includes('empty')) {
      return formatError('FILE_EMPTY', file.name);
    }
    
    if (errors[0].includes('invalid characters')) {
      return formatError('INVALID_FILENAME', file.name);
    }
    
    if (errors[0].includes('255 characters')) {
      return formatError('FILENAME_TOO_LONG', file.name);
    }
    
    return {
      title: 'Validation Error',
      message: errors.join('. '),
      action: 'Please correct the issues and try again'
    };
  }
  
  if (status === 'beta' && warnings.length > 0) {
    return formatError('BETA_FORMAT_WARNING', file.name);
  }
  
  return {
    title: 'Unknown Error',
    message: 'Unable to validate file',
    action: 'Please try again'
  };
}

