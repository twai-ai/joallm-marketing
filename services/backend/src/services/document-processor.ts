import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { marked } from 'marked';
import * as XLSX from 'xlsx';
import { logger } from '../utils/logger.js';
import { adaptiveChunker } from './adaptive-chunker.js';

export interface ExtractedText {
  content: string;
  metadata: {
    pages?: number;
    language?: string;
    wordCount?: number;
    characterCount?: number;
    originalFormat?: string;
    warnings?: string[];
    sheets?: number;
    totalCells?: number;
    [key: string]: any;
  };
}

export class DocumentProcessor {
  async extractText(buffer: Buffer, mimetype: string, filename: string): Promise<ExtractedText> {
    try {
      logger.info(`Extracting text from ${filename} (${mimetype})`);
      
      switch (mimetype) {
        case 'application/pdf':
          return await this.extractFromPDF(buffer, filename);
        case 'text/plain':
          return await this.extractFromText(buffer, filename);
        case 'text/markdown':
        case 'text/x-markdown':
        case 'application/markdown':
          return await this.extractFromMarkdown(buffer, filename);
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        case 'application/msword':
          return await this.extractFromWord(buffer, filename);
        case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        case 'application/vnd.ms-excel':
          return await this.extractFromExcel(buffer, filename);
        case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
        case 'application/vnd.ms-powerpoint':
          return await this.extractFromPowerPoint(buffer, filename);
        case 'image/jpeg':
        case 'image/jpg':
        case 'image/png':
        case 'image/gif':
        case 'image/webp':
        case 'image/bmp':
        case 'image/tiff':
        case 'image/svg+xml':
          return await this.extractFromImage(buffer, filename, mimetype);
        case 'text/csv':
        case 'text/html':
        case 'text/xml':
        case 'application/xml':
        case 'application/json':
        case 'application/yaml':
        case 'text/yaml':
        case 'application/x-yaml':
          return await this.extractFromText(buffer, filename);
        case 'text/rtf':
        case 'application/rtf':
          return await this.extractFromRTF(buffer, filename);
        case 'text/javascript':
        case 'application/javascript':
        case 'text/typescript':
        case 'application/typescript':
        case 'text/python':
        case 'text/x-python':
        case 'text/x-java-source':
        case 'text/x-c':
        case 'text/x-c++':
        case 'text/x-csharp':
        case 'text/x-php':
        case 'text/x-ruby':
        case 'text/x-go':
        case 'text/x-rust':
        case 'text/x-sql':
          return await this.extractFromCode(buffer, filename, mimetype);
        case 'application/zip':
        case 'application/x-zip-compressed':
        case 'application/x-rar-compressed':
        case 'application/x-7z-compressed':
          return await this.extractFromArchive(buffer, filename, mimetype);
        case 'application/epub+zip':
        case 'application/x-mobipocket-ebook':
          return await this.extractFromEbook(buffer, filename, mimetype);
        default:
          // Fallback: check file extension for markdown files
          if (filename.toLowerCase().endsWith('.md') || filename.toLowerCase().endsWith('.markdown')) {
            logger.info(`Treating ${filename} as markdown based on file extension`);
            return await this.extractFromMarkdown(buffer, filename);
          }
          // Check if it's a code file by extension
          if (this.isCodeFileByExtension(filename)) {
            logger.info(`Treating ${filename} as code file based on file extension`);
            return await this.extractFromCode(buffer, filename, mimetype);
          }
          // Check if it's an image by extension
          if (this.isImageFileByExtension(filename)) {
            logger.info(`Treating ${filename} as image file based on file extension`);
            return await this.extractFromImage(buffer, filename, mimetype);
          }
          // Generic fallback for any text-based file
          if (mimetype.startsWith('text/') || mimetype.includes('json') || mimetype.includes('xml') || mimetype.includes('yaml') || mimetype === 'application/octet-stream') {
            logger.info(`Treating ${filename} as text file based on MIME type or fallback`);
            return await this.extractFromText(buffer, filename);
          }
          throw new Error(`Unsupported file type: ${mimetype}`);
      }
    } catch (error) {
      logger.error(`Failed to extract text from ${filename}:`, error);
      throw new Error(`Text extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process document with adaptive chunking
   * This combines text extraction and adaptive chunking in one step
   */
  async processDocument(
    buffer: Buffer,
    filename: string,
    mimetype: string
  ): Promise<{
    extractedText: ExtractedText;
    chunks: Array<{
      content: string;
      index: number;
      startChar: number;
      endChar: number;
      metadata: any;
    }>;
  }> {
    try {
      logger.info(`Processing document with adaptive chunking: ${filename}`);
      
      // Extract text
      const extractedText = await this.extractText(buffer, mimetype, filename);
      
      // Use adaptive chunking
      const chunks = await adaptiveChunker.chunkDocument(
        extractedText.content,
        {
          filename,
          mimetype,
          pages: extractedText.metadata.pages,
          language: extractedText.metadata.language
        }
      );

      logger.info(`Processed ${filename}: ${chunks.length} chunks created using adaptive strategy`);
      
      return { extractedText, chunks };
    } catch (error) {
      logger.error(`Failed to process document ${filename}:`, error);
      throw new Error(`Document processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async extractFromPDF(buffer: Buffer, filename: string): Promise<ExtractedText> {
    try {
      logger.info(`Extracting text from PDF: ${filename}`);
      const data = await pdfParse(buffer);
      
      const content = data.text.trim();
      
      return {
        content,
        metadata: {
          pages: data.numpages,
          wordCount: this.countWords(content),
          characterCount: content.length,
          originalFormat: 'pdf'
        }
      };
    } catch (error) {
      logger.error(`PDF extraction failed for ${filename}:`, error);
      throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async extractFromText(buffer: Buffer, filename: string): Promise<ExtractedText> {
    const content = buffer.toString('utf-8');
    
    return {
      content,
      metadata: {
        wordCount: this.countWords(content),
        characterCount: content.length
      }
    };
  }

  private async extractFromMarkdown(buffer: Buffer, filename: string): Promise<ExtractedText> {
    try {
      const markdown = buffer.toString('utf-8');
      logger.info(`Markdown text length: ${markdown.length} characters`);
      
      // Convert markdown to plain text
      logger.info(`Converting markdown to HTML...`);
      const html = await marked(markdown);
      logger.info(`HTML length: ${html.length} characters, converting to plain text...`);
      
      const plainText = html.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').trim();
      logger.info(`Plain text extracted: ${plainText.length} characters`);
      
      return {
        content: plainText,
        metadata: {
          wordCount: this.countWords(plainText),
          characterCount: plainText.length,
          originalFormat: 'markdown'
        }
      };
    } catch (error) {
      logger.error(`Markdown extraction failed for ${filename}:`, error);
      // Fallback: return raw markdown as plain text
      const fallbackText = buffer.toString('utf-8');
      logger.warn(`Falling back to raw markdown text (${fallbackText.length} chars)`);
      return {
        content: fallbackText,
        metadata: {
          wordCount: this.countWords(fallbackText),
          characterCount: fallbackText.length,
          originalFormat: 'markdown',
          warnings: ['Failed to parse markdown, using raw text']
        }
      };
    }
  }

  private async extractFromWord(buffer: Buffer, filename: string): Promise<ExtractedText> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      
      return {
        content: result.value,
        metadata: {
          wordCount: this.countWords(result.value),
          characterCount: result.value.length,
          warnings: result.messages.length > 0 ? result.messages.map(m => m.message) : undefined
        }
      };
    } catch (error) {
      logger.error(`Word document extraction failed for ${filename}:`, error);
      throw new Error('Failed to extract text from Word document');
    }
  }

  private async extractFromExcel(buffer: Buffer, filename: string): Promise<ExtractedText> {
    try {
      logger.info(`Extracting text from Excel: ${filename}`);
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      
      let allText = '';
      let totalCells = 0;
      
      // Extract text from all sheets
      workbook.SheetNames.forEach((sheetName: string, index: number) => {
        const sheet = workbook.Sheets[sheetName];
        
        // Add sheet name as header
        if (index > 0) allText += '\n\n';
        allText += `=== Sheet: ${sheetName} ===\n\n`;
        
        // Convert sheet to CSV format for better text representation
        const csvData = XLSX.utils.sheet_to_csv(sheet);
        allText += csvData;
        
        // Count cells with data
        const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
        totalCells += (range.e.r - range.s.r + 1) * (range.e.c - range.s.c + 1);
      });
      
      return {
        content: allText.trim(),
        metadata: {
          pages: workbook.SheetNames.length,
          wordCount: this.countWords(allText),
          characterCount: allText.length,
          originalFormat: 'excel',
          sheets: workbook.SheetNames.length,
          totalCells
        }
      };
    } catch (error) {
      logger.error(`Excel extraction failed for ${filename}:`, error);
      throw new Error(`Failed to extract text from Excel: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async extractFromPowerPoint(buffer: Buffer, filename: string): Promise<ExtractedText> {
    try {
      logger.info(`Processing PowerPoint: ${filename}`);
      
      // PowerPoint extraction is complex and requires specialized libraries
      // For now, we'll create a basic representation
      // In production, consider using libraries like:
      // - officegen-pptx-parser
      // - node-pptx
      // - or server-side conversion tools like LibreOffice
      
      logger.warn(`PowerPoint full extraction not yet implemented for ${filename}`);
      
      // Try to detect if it's a modern PPTX (ZIP-based format)
      const fileType = buffer.slice(0, 4).toString('hex');
      const isPPTX = fileType === '504b0304'; // ZIP file signature
      
      return {
        content: `PowerPoint Presentation: ${filename}\n\nNote: PowerPoint text extraction requires additional processing. Please convert to PDF or use "Save As > Plain Text" for full text extraction.\n\nFile type: ${isPPTX ? 'PPTX (Modern)' : 'PPT (Legacy)'}\nSize: ${(buffer.length / 1024).toFixed(2)} KB`,
        metadata: {
          pages: 1,
          wordCount: 20,
          characterCount: 150,
          originalFormat: 'powerpoint',
          warnings: ['PowerPoint text extraction is limited. Consider converting to PDF for better results.']
        }
      };
    } catch (error) {
      logger.error(`PowerPoint processing failed for ${filename}:`, error);
      throw new Error(`Failed to process PowerPoint: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async extractFromRTF(buffer: Buffer, filename: string): Promise<ExtractedText> {
    try {
      logger.info(`Processing RTF file: ${filename}`);
      const rtfString = buffer.toString('utf-8');
      
      // Simple RTF text extraction using regex
      // Remove RTF control words and groups
      let content = rtfString;
      
      // Remove RTF header and control words
      content = content.replace(/\\[a-z]+\d*\s?/g, ' '); // Remove control words
      content = content.replace(/[{}]/g, ''); // Remove braces
      content = content.replace(/\\/g, ''); // Remove backslashes
      
      // Clean up extra whitespace
      content = content.replace(/\s+/g, ' ').trim();
      
      // Remove non-printable characters
      content = content.replace(/[^\x20-\x7E\n\r]/g, '');
      
      return {
        content,
        metadata: {
          wordCount: this.countWords(content),
          characterCount: content.length,
          originalFormat: 'rtf',
          warnings: ['RTF parsed with basic extraction - some formatting may be included']
        }
      };
    } catch (error) {
      logger.error(`RTF processing failed for ${filename}:`, error);
      // Fallback to plain text extraction
      logger.warn(`Falling back to plain text extraction for ${filename}`);
      return await this.extractFromText(buffer, filename);
    }
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  async chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): Promise<Array<{
    content: string;
    index: number;
    startChar: number;
    endChar: number;
    metadata: {
      wordCount: number;
      characterCount: number;
    };
  }>> {
    const chunks: Array<{
      content: string;
      index: number;
      startChar: number;
      endChar: number;
      metadata: {
        wordCount: number;
        characterCount: number;
      };
    }> = [];

    let startIndex = 0;
    let chunkIndex = 0;
    let iterations = 0;
    const MAX_ITERATIONS = 10000; // Safety limit to prevent infinite loops

    logger.info(`Starting chunking: text length=${text.length}, chunkSize=${chunkSize}, overlap=${overlap}`);

    while (startIndex < text.length && iterations < MAX_ITERATIONS) {
      iterations++;
      const previousStartIndex = startIndex;
      const endIndex = Math.min(startIndex + chunkSize, text.length);
      
      // Try to break at sentence boundary if possible
      let actualEndIndex = endIndex;
      if (endIndex < text.length) {
        const sentenceEnd = text.lastIndexOf('.', endIndex);
        const paragraphEnd = text.lastIndexOf('\n\n', endIndex);
        const lineEnd = text.lastIndexOf('\n', endIndex);
        
        // Use the closest break point
        const breakPoint = Math.max(sentenceEnd, paragraphEnd, lineEnd);
        if (breakPoint > startIndex + chunkSize * 0.5) {
          actualEndIndex = breakPoint + 1;
        }
      }

      const chunkContent = text.slice(startIndex, actualEndIndex).trim();
      
      if (chunkContent.length > 0) {
        chunks.push({
          content: chunkContent,
          index: chunkIndex,
          startChar: startIndex,
          endChar: actualEndIndex,
          metadata: {
            wordCount: this.countWords(chunkContent),
            characterCount: chunkContent.length
          }
        });
        chunkIndex++;
      }

      // Move start index forward, accounting for overlap
      const nextStartIndex = actualEndIndex - overlap;
      
      // CRITICAL: Ensure we always move forward to prevent infinite loops
      if (nextStartIndex <= previousStartIndex) {
        // Can't go backwards or stay in place - must move forward
        startIndex = actualEndIndex;
      } else {
        startIndex = nextStartIndex;
      }

      // Safety check: if we haven't moved forward at all, force progress
      if (startIndex <= previousStartIndex) {
        logger.warn(`Chunking stuck at position ${startIndex}, forcing progress`);
        startIndex = previousStartIndex + Math.max(1, chunkSize / 2);
      }
    }

    if (iterations >= MAX_ITERATIONS) {
      logger.error(`Chunking hit iteration limit! This indicates an infinite loop bug.`);
      throw new Error('Chunking process exceeded maximum iterations');
    }

    logger.info(`Created ${chunks.length} chunks from text (${text.length} characters) in ${iterations} iterations`);
    return chunks;
  }

  private async extractFromImage(buffer: Buffer, filename: string, mimetype: string): Promise<ExtractedText> {
    try {
      logger.info(`Processing image file: ${filename} (${mimetype})`);
      
      // For images, we'll create a basic description and store metadata
      // In a production system, you might want to use OCR or AI vision services
      const imageInfo = {
        filename,
        mimetype,
        size: buffer.length,
        type: 'image'
      };

      // Create a basic text representation for searchability
      const content = `Image file: ${filename}\nType: ${mimetype}\nSize: ${(buffer.length / 1024).toFixed(2)} KB\nThis is an image file that can be used for visual content and analysis.`;

      return {
        content,
        metadata: {
          ...imageInfo,
          language: 'en',
          pages: 1
        }
      };
    } catch (error) {
      logger.error(`Failed to process image ${filename}:`, error);
      throw new Error(`Image processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async extractFromCode(buffer: Buffer, filename: string, mimetype: string): Promise<ExtractedText> {
    try {
      logger.info(`Processing code file: ${filename} (${mimetype})`);
      
      const content = buffer.toString('utf-8');
      const codeInfo = {
        filename,
        mimetype,
        size: buffer.length,
        type: 'code',
        language: this.detectProgrammingLanguage(filename, mimetype)
      };

      return {
        content,
        metadata: {
          ...codeInfo,
          language: codeInfo.language,
          pages: 1
        }
      };
    } catch (error) {
      logger.error(`Failed to process code file ${filename}:`, error);
      throw new Error(`Code processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async extractFromArchive(buffer: Buffer, filename: string, mimetype: string): Promise<ExtractedText> {
    try {
      logger.info(`Processing archive file: ${filename} (${mimetype})`);
      
      // For archives, we'll create a basic description
      // In a production system, you might want to extract and process contents
      const archiveInfo = {
        filename,
        mimetype,
        size: buffer.length,
        type: 'archive'
      };

      const content = `Archive file: ${filename}\nType: ${mimetype}\nSize: ${(buffer.length / 1024).toFixed(2)} KB\nThis is an archive file containing multiple documents that can be extracted and processed.`;

      return {
        content,
        metadata: {
          ...archiveInfo,
          language: 'en',
          pages: 1
        }
      };
    } catch (error) {
      logger.error(`Failed to process archive ${filename}:`, error);
      throw new Error(`Archive processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async extractFromEbook(buffer: Buffer, filename: string, mimetype: string): Promise<ExtractedText> {
    try {
      logger.info(`Processing ebook file: ${filename} (${mimetype})`);
      
      // For ebooks, we'll create a basic description
      // In a production system, you might want to extract text content
      const ebookInfo = {
        filename,
        mimetype,
        size: buffer.length,
        type: 'ebook'
      };

      const content = `Ebook file: ${filename}\nType: ${mimetype}\nSize: ${(buffer.length / 1024).toFixed(2)} KB\nThis is an ebook file that can be processed to extract text content for reading and analysis.`;

      return {
        content,
        metadata: {
          ...ebookInfo,
          language: 'en',
          pages: 1
        }
      };
    } catch (error) {
      logger.error(`Failed to process ebook ${filename}:`, error);
      throw new Error(`Ebook processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private detectProgrammingLanguage(filename: string, mimetype: string): string {
    const ext = filename.toLowerCase().split('.').pop();
    const mimeMap: Record<string, string> = {
      'js': 'javascript',
      'ts': 'typescript',
      'py': 'python',
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'cc': 'cpp',
      'cxx': 'cpp',
      'cs': 'csharp',
      'php': 'php',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
      'sql': 'sql',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'sass': 'sass',
      'less': 'less',
      'xml': 'xml',
      'json': 'json',
      'yaml': 'yaml',
      'yml': 'yaml'
    };

    if (ext && mimeMap[ext]) {
      return mimeMap[ext];
    }

    // Fallback to MIME type detection
    if (mimetype.includes('javascript')) return 'javascript';
    if (mimetype.includes('typescript')) return 'typescript';
    if (mimetype.includes('python')) return 'python';
    if (mimetype.includes('java')) return 'java';
    if (mimetype.includes('c++')) return 'cpp';
    if (mimetype.includes('csharp')) return 'csharp';
    if (mimetype.includes('php')) return 'php';
    if (mimetype.includes('ruby')) return 'ruby';
    if (mimetype.includes('go')) return 'go';
    if (mimetype.includes('rust')) return 'rust';
    if (mimetype.includes('sql')) return 'sql';

    return 'text';
  }

  private isCodeFileByExtension(filename: string): boolean {
    const ext = filename.toLowerCase().split('.').pop();
    const codeExtensions = [
      'js', 'ts', 'py', 'java', 'c', 'cpp', 'cc', 'cxx', 'cs', 'php', 'rb', 'go', 'rs', 'sql',
      'html', 'css', 'scss', 'sass', 'less', 'xml', 'json', 'yaml', 'yml'
    ];
    return ext ? codeExtensions.includes(ext) : false;
  }

  private isImageFileByExtension(filename: string): boolean {
    const ext = filename.toLowerCase().split('.').pop();
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'svg'];
    return ext ? imageExtensions.includes(ext) : false;
  }
}

export const documentProcessor = new DocumentProcessor();
