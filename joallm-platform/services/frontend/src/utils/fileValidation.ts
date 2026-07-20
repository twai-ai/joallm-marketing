// Centralized file validation utility
// Single source of truth for file format support across the application

export const FILE_CONFIG = {
  // File size limits
  MAX_FILE_SIZE_MB: 50,
  CHAT_MAX_FILE_SIZE_MB: 10,
  MEDIA_MAX_FILE_SIZE_MB: 500,

  // Fully supported formats (work perfectly)
  SUPPORTED_FORMATS: [
    '.txt', '.md', '.markdown', '.csv', '.html', '.xml', '.rtf',
    '.doc', '.docx',
  ],

  // Beta formats (limited functionality, show warnings)
  BETA_FORMATS: [
    '.pdf',
  ],

  // Coming soon formats (accepted in UI but blocked from upload)
  COMING_SOON_FORMATS: [
    '.xlsx', '.xls', '.pptx', '.ppt', '.odt', '.ods', '.odp',
  ],

  // Image formats (metadata only, no OCR)
  IMAGE_FORMATS: [
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.svg',
  ],

  // Video formats — media intelligence pipeline
  VIDEO_FORMATS: [
    '.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.flv', '.wmv',
  ],

  // Audio formats — transcription pipeline
  AUDIO_FORMATS: [
    '.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.opus', '.wma',
  ],

  // Code file formats (plain text extraction)
  CODE_FORMATS: [
    '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.c', '.cpp', '.cs',
    '.php', '.rb', '.go', '.rs', '.sql', '.sh', '.bash',
  ],

  // Archive formats (coming soon)
  ARCHIVE_FORMATS: [
    '.zip', '.rar', '.7z',
  ],

  // Data formats
  DATA_FORMATS: [
    '.json', '.yaml', '.yml',
  ],

  // Ebook formats (coming soon)
  EBOOK_FORMATS: [
    '.epub', '.mobi',
  ],
  
  // MIME type mappings
  MIME_TYPES: {
    // Supported
    'text/plain': 'supported',
    'text/markdown': 'supported',
    'text/x-markdown': 'supported',
    'application/markdown': 'supported',
    'text/csv': 'supported',
    'text/html': 'supported',
    'text/xml': 'supported',
    'application/xml': 'supported',
    'text/rtf': 'supported',
    'application/rtf': 'supported',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'supported', // .docx
    'application/msword': 'supported', // .doc
    
    // Beta
    'application/pdf': 'beta',
    
    // Coming soon (Excel, PowerPoint, OpenDocument)
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'coming-soon', // .xlsx
    'application/vnd.ms-excel': 'coming-soon', // .xls
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'coming-soon', // .pptx
    'application/vnd.ms-powerpoint': 'coming-soon', // .ppt
    'application/vnd.oasis.opendocument.text': 'coming-soon', // .odt
    'application/vnd.oasis.opendocument.spreadsheet': 'coming-soon', // .ods
    'application/vnd.oasis.opendocument.presentation': 'coming-soon', // .odp
    
    // Images
    'image/jpeg': 'supported',
    'image/jpg': 'supported',
    'image/png': 'supported',
    'image/gif': 'supported',
    'image/webp': 'supported',
    'image/bmp': 'supported',
    'image/tiff': 'supported',
    'image/svg+xml': 'supported',

    // Video
    'video/mp4': 'supported',
    'video/quicktime': 'supported',
    'video/x-msvideo': 'supported',
    'video/x-matroska': 'supported',
    'video/webm': 'supported',
    'video/x-m4v': 'supported',
    'video/x-flv': 'supported',
    'video/x-ms-wmv': 'supported',

    // Audio
    'audio/mpeg': 'supported',
    'audio/mp3': 'supported',
    'audio/wav': 'supported',
    'audio/x-wav': 'supported',
    'audio/flac': 'supported',
    'audio/x-flac': 'supported',
    'audio/mp4': 'supported',
    'audio/m4a': 'supported',
    'audio/x-m4a': 'supported',
    'audio/aac': 'supported',
    'audio/ogg': 'supported',
    'audio/opus': 'supported',
    'audio/x-ms-wma': 'supported',
    
    // Code files
    'text/javascript': 'supported',
    'application/javascript': 'supported',
    'text/typescript': 'supported',
    'application/typescript': 'supported',
    'text/x-python': 'supported',
    'application/json': 'supported',
    'application/x-yaml': 'supported',
    'text/yaml': 'supported',
    
    // Archives (coming soon)
    'application/zip': 'coming-soon',
    'application/x-zip-compressed': 'coming-soon',
    'application/x-rar-compressed': 'coming-soon',
    'application/x-7z-compressed': 'coming-soon',
    
    // Ebooks (coming soon)
    'application/epub+zip': 'coming-soon',
    'application/x-mobipocket-ebook': 'coming-soon',
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

/**
 * Get the support status for a file extension
 */
export function getFormatStatus(extension: string): FormatStatus {
  const ext = extension.toLowerCase().startsWith('.') ? extension.toLowerCase() : `.${extension.toLowerCase()}`;
  
  if (FILE_CONFIG.SUPPORTED_FORMATS.includes(ext) ||
      FILE_CONFIG.IMAGE_FORMATS.includes(ext) ||
      FILE_CONFIG.VIDEO_FORMATS.includes(ext) ||
      FILE_CONFIG.AUDIO_FORMATS.includes(ext) ||
      FILE_CONFIG.CODE_FORMATS.includes(ext) ||
      FILE_CONFIG.DATA_FORMATS.includes(ext)) {
    return 'supported';
  }
  
  if (FILE_CONFIG.BETA_FORMATS.includes(ext)) {
    return 'beta';
  }
  
  if (FILE_CONFIG.COMING_SOON_FORMATS.includes(ext) || 
      FILE_CONFIG.ARCHIVE_FORMATS.includes(ext) ||
      FILE_CONFIG.EBOOK_FORMATS.includes(ext)) {
    return 'coming-soon';
  }
  
  return 'unsupported';
}

/**
 * Get the support status from MIME type
 */
export function getFormatStatusFromMimeType(mimeType: string): FormatStatus {
  return FILE_CONFIG.MIME_TYPES[mimeType] || 'unsupported';
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  if (bytes < 1024) return `${bytes} Bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? `.${parts[parts.length - 1].toLowerCase()}` : '';
}

/**
 * Validate a file for upload
 * @param file - The file to validate
 * @param maxSizeMB - Maximum file size in MB (defaults to FILE_CONFIG.MAX_FILE_SIZE_MB)
 * @returns Validation result with status, errors, and warnings
 */
export function validateFile(file: File, maxSizeMB: number = FILE_CONFIG.MAX_FILE_SIZE_MB): FileValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Get file info
  const extension = getFileExtension(file.name);
  const sizeFormatted = formatFileSize(file.size);
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  
  // Check if file exists
  if (!file) {
    errors.push('No file provided');
    return {
      isValid: false,
      status: 'unsupported',
      errors,
      warnings,
      fileInfo: {
        name: '',
        size: 0,
        sizeFormatted: '0 Bytes',
        extension: '',
        mimeType: '',
      },
    };
  }
  
  // Check filename
  if (!file.name || file.name.length === 0) {
    errors.push('Filename is required');
  } else if (file.name.length > 255) {
    errors.push('Filename must be less than 255 characters');
  } else if (!/^[^<>:"/\\|?*]+$/.test(file.name)) {
    errors.push('Filename contains invalid characters');
  }
  
  // Check file size
  if (file.size === 0) {
    errors.push('File is empty');
  } else if (file.size > maxSizeBytes) {
    errors.push(`File size (${sizeFormatted}) exceeds maximum allowed size of ${maxSizeMB}MB`);
  }
  
  // Check format status
  const statusFromMime = getFormatStatusFromMimeType(file.type);
  const statusFromExt = getFormatStatus(extension);
  
  // Use the more permissive status (prefer extension over MIME type for flexibility)
  const status = statusFromExt !== 'unsupported' ? statusFromExt : statusFromMime;
  
  // Add appropriate messages based on status
  if (status === 'unsupported') {
    errors.push(
      `File type "${extension}" is not supported. Supported formats: ${FILE_CONFIG.SUPPORTED_FORMATS.join(', ')}`
    );
  } else if (status === 'coming-soon') {
    errors.push(
      `File type "${extension}" is not yet supported. This format is in active development. ` +
      `Please convert to a supported format: ${FILE_CONFIG.SUPPORTED_FORMATS.slice(0, 5).join(', ')}, etc.`
    );
  } else if (status === 'beta') {
    warnings.push(
      `File type "${extension}" has limited support. Text extraction is in beta and search results may be incomplete.`
    );
  }
  
  // Add specific warnings for certain formats
  if (FILE_CONFIG.IMAGE_FORMATS.includes(extension)) {
    warnings.push('Images are indexed by filename and metadata only. Text in images is not extracted (OCR coming soon).');
  }

  if (FILE_CONFIG.VIDEO_FORMATS.includes(extension)) {
    warnings.push('Video will be transcribed and analyzed for media intelligence. Large files (>100MB) may take a few minutes.');
  }

  if (FILE_CONFIG.AUDIO_FORMATS.includes(extension)) {
    warnings.push('Audio will be transcribed automatically. Processing time depends on file length.');
  }
  
  if (FILE_CONFIG.CODE_FORMATS.includes(extension)) {
    warnings.push('Code files are processed as plain text without syntax analysis.');
  }
  
  const fileInfo = {
    name: file.name,
    size: file.size,
    sizeFormatted,
    extension,
    mimeType: file.type,
  };
  
  return {
    isValid: errors.length === 0 && status !== 'coming-soon' && status !== 'unsupported',
    status,
    errors,
    warnings,
    fileInfo,
  };
}

/**
 * Validate multiple files for upload
 */
export function validateFiles(files: File[], maxSizeMB: number = FILE_CONFIG.MAX_FILE_SIZE_MB): FileValidationResult[] {
  return files.map(file => validateFile(file, maxSizeMB));
}

/**
 * Get list of all supported file extensions for use in file input accept attribute
 */
export function getSupportedFileExtensions(includeBeta: boolean = true): string {
  const supported = [
    ...FILE_CONFIG.SUPPORTED_FORMATS,
    ...FILE_CONFIG.IMAGE_FORMATS,
    ...FILE_CONFIG.VIDEO_FORMATS,
    ...FILE_CONFIG.AUDIO_FORMATS,
    ...FILE_CONFIG.CODE_FORMATS,
    ...FILE_CONFIG.DATA_FORMATS,
  ];
  
  if (includeBeta) {
    supported.push(...FILE_CONFIG.BETA_FORMATS);
  }
  
  return supported.join(',');
}

/**
 * Get user-friendly description of supported formats
 */
export function getSupportedFormatsDescription(): string {
  return [
    'Documents: TXT, MD, DOC, DOCX, CSV, HTML, XML, RTF',
    'Images: JPG, PNG, GIF, WebP, BMP, TIFF, SVG',
    'Video: MP4, MOV, AVI, MKV, WebM, and more',
    'Audio: MP3, WAV, FLAC, M4A, AAC, OGG, and more',
    'Code: JS, TS, PY, Java, C++, and more',
    'Data: JSON, YAML',
    'Beta: PDF (limited support)',
  ].join(' • ');
}

/**
 * Check if a file can be uploaded (not coming-soon or unsupported)
 */
export function canUploadFile(file: File): boolean {
  const validation = validateFile(file);
  return validation.isValid || validation.status === 'beta';
}

