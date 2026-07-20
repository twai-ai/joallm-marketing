// User-friendly error messages - Mirrored from frontend

export interface UserErrorMessage {
  title: string;
  message: string | ((...args: any[]) => string);
  action?: string;
  docLink?: string;
}

export const USER_ERRORS: Record<string, UserErrorMessage> = {
  UNSUPPORTED_FORMAT: {
    title: 'File type not supported',
    message: (filename: string, format: string) => `${filename} (${format}) isn't supported yet.`,
    action: 'Try converting to .docx or .txt format'
  },
  COMING_SOON_FORMAT: {
    title: 'Format in development',
    message: (filename: string, format: string) => `${filename} (${format}) support is coming soon!`,
    action: 'Convert to .docx, .txt, or .md'
  },
  FILE_TOO_LARGE: {
    title: 'File too large',
    message: (filename: string, size: string, limit: string) => `${filename} (${size}) exceeds the ${limit} limit.`,
    action: 'Try compressing or splitting the file'
  },
  NETWORK_ERROR: {
    title: 'Upload failed',
    message: 'Network connection issue. Please try again.',
    action: 'Check your internet connection'
  }
};

export function formatError(errorKey: keyof typeof USER_ERRORS, ...args: any[]) {
  const error = USER_ERRORS[errorKey];
  if (!error) return { title: 'Error', message: 'An unexpected error occurred' };
  const message = typeof error.message === 'function' ? error.message(...args) : error.message;
  return { title: error.title, message, action: error.action, docLink: error.docLink };
}

export function parseBackendError(error: any): { title: string; message: string; action?: string } {
  if (error?.response?.data?.message) {
    return { title: 'Upload Error', message: error.response.data.message };
  }
  if (error?.message) {
    if (error.message.includes('Network Error')) return formatError('NETWORK_ERROR');
    return { title: 'Error', message: error.message };
  }
  return { title: 'Error', message: 'An unexpected error occurred' };
}

