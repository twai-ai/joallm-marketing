// Centralized file validation utility
// Single source of truth for file format support across the application
// Mirrored from frontend for consistency

export const FILE_CONFIG = {
  MAX_FILE_SIZE_MB: 50,
  CHAT_MAX_FILE_SIZE_MB: 10,
  SUPPORTED_FORMATS: ['.txt', '.md', '.markdown', '.csv', '.html', '.xml', '.rtf', '.doc', '.docx'],
  BETA_FORMATS: ['.pdf'],
  COMING_SOON_FORMATS: ['.xlsx', '.xls', '.pptx', '.ppt', '.odt', '.ods', '.odp'],
  IMAGE_FORMATS: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.svg'],
  CODE_FORMATS: ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.c', '.cpp', '.cs', '.php', '.rb', '.go', '.rs', '.sql', '.sh', '.bash'],
  ARCHIVE_FORMATS: ['.zip', '.rar', '.7z'],
  DATA_FORMATS: ['.json', '.yaml', '.yml'],
  EBOOK_FORMATS: ['.epub', '.mobi'],
  MIME_TYPES: {
    'text/plain': 'supported', 'text/markdown': 'supported', 'text/csv': 'supported',
    'text/html': 'supported', 'text/xml': 'supported', 'text/rtf': 'supported',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'supported',
    'application/msword': 'supported', 'application/pdf': 'beta',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'coming-soon',
    'application/vnd.ms-excel': 'coming-soon',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'coming-soon',
    'application/vnd.ms-powerpoint': 'coming-soon',
    'image/jpeg': 'supported', 'image/png': 'supported', 'image/gif': 'supported',
    'application/json': 'supported', 'application/x-yaml': 'supported'
  } as Record<string, FormatStatus>,
};

export type FormatStatus = 'supported' | 'beta' | 'coming-soon' | 'unsupported';

export interface FileValidationResult {
  isValid: boolean;
  status: FormatStatus;
  errors: string[];
  warnings: string[];
  fileInfo: {
    name: string;
    size: number;
    sizeFormatted: string;
    extension: string;
    mimeType: string;
  };
}

export function getFormatStatus(extension: string): FormatStatus {
  const ext = extension.toLowerCase().startsWith('.') ? extension.toLowerCase() : `.${extension.toLowerCase()}`;
  if (FILE_CONFIG.SUPPORTED_FORMATS.includes(ext) || FILE_CONFIG.IMAGE_FORMATS.includes(ext) || FILE_CONFIG.CODE_FORMATS.includes(ext) || FILE_CONFIG.DATA_FORMATS.includes(ext)) return 'supported';
  if (FILE_CONFIG.BETA_FORMATS.includes(ext)) return 'beta';
  if (FILE_CONFIG.COMING_SOON_FORMATS.includes(ext) || FILE_CONFIG.ARCHIVE_FORMATS.includes(ext) || FILE_CONFIG.EBOOK_FORMATS.includes(ext)) return 'coming-soon';
  return 'unsupported';
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  if (bytes < 1024) return `${bytes} Bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? `.${parts[parts.length - 1].toLowerCase()}` : '';
}

export function validateFile(file: File, maxSizeMB: number = FILE_CONFIG.MAX_FILE_SIZE_MB): FileValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const extension = getFileExtension(file.name);
  const sizeFormatted = formatFileSize(file.size);
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  
  if (!file) {
    return { isValid: false, status: 'unsupported', errors: ['No file provided'], warnings: [], fileInfo: { name: '', size: 0, sizeFormatted: '0 Bytes', extension: '', mimeType: '' }};
  }
  
  if (file.size === 0) errors.push('File is empty');
  else if (file.size > maxSizeBytes) errors.push(`File size (${sizeFormatted}) exceeds maximum allowed size of ${maxSizeMB}MB`);
  
  const status = getFormatStatus(extension);
  
  if (status === 'unsupported') errors.push(`File type "${extension}" is not supported.`);
  else if (status === 'coming-soon') errors.push(`File type "${extension}" is not yet supported. Convert to .docx or .txt.`);
  else if (status === 'beta') warnings.push(`File type "${extension}" has limited support.`);
  
  return {
    isValid: errors.length === 0 && status !== 'coming-soon' && status !== 'unsupported',
    status,
    errors,
    warnings,
    fileInfo: { name: file.name, size: file.size, sizeFormatted, extension, mimeType: file.type },
  };
}

export function getSupportedFileExtensions(includeBeta: boolean = true): string {
  const supported = [...FILE_CONFIG.SUPPORTED_FORMATS, ...FILE_CONFIG.IMAGE_FORMATS, ...FILE_CONFIG.CODE_FORMATS, ...FILE_CONFIG.DATA_FORMATS];
  if (includeBeta) supported.push(...FILE_CONFIG.BETA_FORMATS);
  return supported.join(',');
}

