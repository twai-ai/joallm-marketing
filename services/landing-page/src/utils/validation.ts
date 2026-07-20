// Frontend validation utilities
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export class ValidationUtils {
  // Email validation
  static validateEmail(email: string): ValidationResult {
    const errors: ValidationError[] = [];
    
    if (!email) {
      errors.push({ field: 'email', message: 'Email is required', code: 'required' });
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({ field: 'email', message: 'Invalid email format', code: 'format' });
    } else if (email.length > 254) {
      errors.push({ field: 'email', message: 'Email must be less than 254 characters', code: 'maxLength' });
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Password validation
  static validatePassword(password: string): ValidationResult {
    const errors: ValidationError[] = [];
    
    if (!password) {
      errors.push({ field: 'password', message: 'Password is required', code: 'required' });
    } else {
      if (password.length < 8) {
        errors.push({ field: 'password', message: 'Password must be at least 8 characters', code: 'minLength' });
      }
      if (password.length > 128) {
        errors.push({ field: 'password', message: 'Password must be less than 128 characters', code: 'maxLength' });
      }
      if (!/(?=.*[a-z])/.test(password)) {
        errors.push({ field: 'password', message: 'Password must contain at least one lowercase letter', code: 'lowercase' });
      }
      if (!/(?=.*[A-Z])/.test(password)) {
        errors.push({ field: 'password', message: 'Password must contain at least one uppercase letter', code: 'uppercase' });
      }
      if (!/(?=.*\d)/.test(password)) {
        errors.push({ field: 'password', message: 'Password must contain at least one number', code: 'number' });
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Name validation
  static validateName(name: string): ValidationResult {
    const errors: ValidationError[] = [];
    
    if (!name) {
      errors.push({ field: 'name', message: 'Name is required', code: 'required' });
    } else {
      if (name.length < 2) {
        errors.push({ field: 'name', message: 'Name must be at least 2 characters', code: 'minLength' });
      }
      if (name.length > 100) {
        errors.push({ field: 'name', message: 'Name must be less than 100 characters', code: 'maxLength' });
      }
      if (!/^[a-zA-Z\s\-'.]+$/.test(name)) {
        errors.push({ field: 'name', message: 'Name can only contain letters, spaces, hyphens, apostrophes, and periods', code: 'format' });
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // File validation - Updated to match frontend (removed unsupported formats)
  static validateFile(file: File): ValidationResult {
    const errors: ValidationError[] = [];
    
    if (!file) {
      errors.push({ field: 'file', message: 'File is required', code: 'required' });
      return {
        isValid: false,
        errors
      };
    }
    
    // Check file size (50MB limit)
    if (file.size > 50 * 1024 * 1024) {
      errors.push({ field: 'file', message: 'File size must be less than 50MB', code: 'maxSize' });
    }
    
    // Check file type - Updated to exclude unsupported formats
    const allowedTypes = [
      // PDF documents (Beta support)
      'application/pdf',
      
      // Text documents (Fully supported)
      'text/plain',
      'text/markdown',
      'text/x-markdown',
      'application/markdown',
      'text/x-markdown; charset=utf-8',
      'text/csv',
      'text/html',
      'text/xml',
      'application/xml',
      'text/rtf',
      'application/rtf',
      
      // Microsoft Office documents (Only Word - DOCX/DOC supported)
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/msword', // .doc
      // REMOVED: Excel and PowerPoint (coming soon)
      
      // REMOVED: OpenDocument formats (coming soon)
      
      // Images (Metadata only - fully supported)
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/bmp',
      'image/tiff',
      'image/svg+xml',
      
      // REMOVED: Archives (coming soon)
      
      // JSON and data formats (Fully supported)
      'application/json',
      'application/yaml',
      'text/yaml',
      'application/x-yaml',
      
      // Code files (Plain text extraction - fully supported)
      'text/javascript',
      'application/javascript',
      'text/typescript',
      'application/typescript',
      'text/python',
      'text/x-python',
      'text/x-java-source',
      'text/x-c',
      'text/x-c++',
      'text/x-csharp',
      'text/x-php',
      'text/x-ruby',
      'text/x-go',
      'text/x-rust',
      'text/x-sql',
      
      // REMOVED: Ebooks (coming soon)
      // REMOVED: Outlook/Email files (coming soon)
    ];
    
    if (!allowedTypes.includes(file.type)) {
      errors.push({ 
        field: 'file', 
        message: 'File type not supported. Supported formats: Documents (TXT, MD, DOC, DOCX, CSV, HTML, XML, RTF), Images (JPEG, PNG, GIF, WebP, BMP, TIFF, SVG), Code files (JS, TS, PY, Java, C++, etc.), Data (JSON, YAML), and PDF (Beta). Excel, PowerPoint, and OpenDocument formats coming soon.', 
        code: 'type' 
      });
    }
    
    // Check filename
    if (!file.name || file.name.length === 0) {
      errors.push({ field: 'file', message: 'Filename is required', code: 'filename' });
    } else if (file.name.length > 255) {
      errors.push({ field: 'file', message: 'Filename must be less than 255 characters', code: 'filenameLength' });
    } else if (!/^[^<>:"/\\|?*]+$/.test(file.name)) {
      errors.push({ field: 'file', message: 'Filename contains invalid characters', code: 'filenameFormat' });
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Message content validation
  static validateMessageContent(content: string): ValidationResult {
    const errors: ValidationError[] = [];
    
    if (!content) {
      errors.push({ field: 'content', message: 'Message content is required', code: 'required' });
    } else {
      if (content.length > 10000) {
        errors.push({ field: 'content', message: 'Message content must be less than 10,000 characters', code: 'maxLength' });
      }
      if (content.trim().length === 0) {
        errors.push({ field: 'content', message: 'Message content cannot be empty', code: 'empty' });
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Search query validation
  static validateSearchQuery(query: string): ValidationResult {
    const errors: ValidationError[] = [];
    
    if (!query) {
      errors.push({ field: 'query', message: 'Search query is required', code: 'required' });
    } else {
      if (query.length > 1000) {
        errors.push({ field: 'query', message: 'Search query must be less than 1,000 characters', code: 'maxLength' });
      }
      if (query.trim().length === 0) {
        errors.push({ field: 'query', message: 'Search query cannot be empty', code: 'empty' });
      }
      if (/[<>]/.test(query)) {
        errors.push({ field: 'query', message: 'Search query contains invalid characters', code: 'invalidChars' });
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // URL validation
  static validateUrl(url: string): ValidationResult {
    const errors: ValidationError[] = [];
    
    if (!url) {
      errors.push({ field: 'url', message: 'URL is required', code: 'required' });
    } else {
      try {
        new URL(url);
      } catch {
        errors.push({ field: 'url', message: 'Invalid URL format', code: 'format' });
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // UUID validation
  static validateUuid(uuid: string): ValidationResult {
    const errors: ValidationError[] = [];
    
    if (!uuid) {
      errors.push({ field: 'uuid', message: 'UUID is required', code: 'required' });
    } else {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(uuid)) {
        errors.push({ field: 'uuid', message: 'Invalid UUID format', code: 'format' });
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Sanitization functions
  static sanitizeHtml(input: string): string {
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  static sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_|_$/g, '');
  }

  static sanitizeQuery(query: string): string {
    return query
      .trim()
      .replace(/[<>]/g, '')
      .replace(/\s+/g, ' ')
      .substring(0, 1000);
  }

  static sanitizeContent(content: string): string {
    return content
      .trim()
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n');
  }

  // Form validation helpers
  static validateForm<T extends Record<string, any>>(
    data: T,
    validators: Record<keyof T, (value: any) => ValidationResult>
  ): ValidationResult {
    const allErrors: ValidationError[] = [];
    
    for (const [field, validator] of Object.entries(validators)) {
      const result = validator(data[field]);
      if (!result.isValid) {
        allErrors.push(...result.errors);
      }
    }
    
    return {
      isValid: allErrors.length === 0,
      errors: allErrors
    };
  }

  // Real-time validation for form fields
  static createFieldValidator<T>(
    validator: (value: T) => ValidationResult,
    debounceMs: number = 300
  ) {
    let timeoutId: NodeJS.Timeout;
    
    return (value: T, callback: (result: ValidationResult) => void) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const result = validator(value);
        callback(result);
      }, debounceMs);
    };
  }
}

// React hook for form validation
export function useFormValidation<T extends Record<string, any>>(
  initialData: T,
  validators: Record<keyof T, (value: any) => ValidationResult>
) {
  const [data, setData] = React.useState<T>(initialData);
  const [errors, setErrors] = React.useState<ValidationError[]>([]);
  const [touched, setTouched] = React.useState<Record<keyof T, boolean>>({} as Record<keyof T, boolean>);

  const validateField = (field: keyof T, value: any) => {
    const result = validators[field](value);
    setErrors(prev => {
      const newErrors = prev.filter(error => error.field !== field);
      return [...newErrors, ...result.errors];
    });
    return result.isValid;
  };

  const validateForm = () => {
    const result = ValidationUtils.validateForm(data, validators);
    setErrors(result.errors);
    return result.isValid;
  };

  const setFieldValue = (field: keyof T, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
    setTouched(prev => ({ ...prev, [field]: true }));
    
    // Validate field if it's been touched
    if (touched[field]) {
      validateField(field, value);
    }
  };

  const setFieldTouched = (field: keyof T) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    validateField(field, data[field]);
  };

  const getFieldError = (field: keyof T) => {
    return errors.find(error => error.field === field)?.message;
  };

  const hasFieldError = (field: keyof T) => {
    return errors.some(error => error.field === field);
  };

  const reset = () => {
    setData(initialData);
    setErrors([]);
    setTouched({} as Record<keyof T, boolean>);
  };

  return {
    data,
    errors,
    touched,
    setFieldValue,
    setFieldTouched,
    validateField,
    validateForm,
    getFieldError,
    hasFieldError,
    reset,
    isValid: errors.length === 0
  };
}

// Import React for the hook
import React from 'react';
