import { logger } from '../utils/logger.js';

type SizeClass = "tiny" | "small" | "medium" | "large" | "very_large";

interface ChunkConfig {
  sizeClass: SizeClass;
  target: number;
  overlap: number;
  retrievalK: number;
}

interface DocumentElement {
  type: 'paragraph' | 'heading' | 'table' | 'code' | 'list' | 'figure';
  text: string;
  caption?: string;
  level?: number; // for headings
  metadata?: Record<string, any>;
}

export class AdaptiveChunker {
  
  /**
   * Choose chunking configuration based on document size
   */
  chooseChunkConfig(totalTokens: number): ChunkConfig {
    let sizeClass: SizeClass;
    let target: number;
    let overlap: number;
    let retrievalK: number;

    if (totalTokens <= 1200) {
      sizeClass = "tiny";
      target = totalTokens;  // Single chunk
      overlap = 0;
      retrievalK = 3;
    } else if (totalTokens <= 6000) {
      sizeClass = "small";
      target = 500;    // 400-600 range
      overlap = 70;    // 60-80 range
      retrievalK = 10;
    } else if (totalTokens <= 30000) {
      sizeClass = "large";
      target = 320;    // 250-400 range
      overlap = 50;    // 40-60 range
      retrievalK = 16;
    } else {
      sizeClass = "very_large";
      target = 240;    // 200-300 range
      overlap = 40;    // 30-50 range
      retrievalK = 24;
    }

    return { sizeClass, target, overlap, retrievalK };
  }

  /**
   * Simple token counter (characters / 4 is rough approximation)
   * Replace with actual tokenizer for production
   */
  private estimateTokens(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters
    // For production, use: tiktoken or @anthropic-ai/tokenizer
    return Math.ceil(text.length / 4);
  }

  /**
   * Extract structured elements from text
   */
  private parseElements(text: string): DocumentElement[] {
    const elements: DocumentElement[] = [];
    const lines = text.split('\n');
    let currentParagraph: string[] = [];
    let inCodeBlock = false;
    let codeBlock: string[] = [];
    let codeLanguage = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Code blocks
      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          // End code block
          elements.push({
            type: 'code',
            text: codeBlock.join('\n'),
            metadata: { language: codeLanguage }
          });
          codeBlock = [];
          codeLanguage = '';
          inCodeBlock = false;
        } else {
          // Start code block
          if (currentParagraph.length > 0) {
            elements.push({
              type: 'paragraph',
              text: currentParagraph.join('\n')
            });
            currentParagraph = [];
          }
          codeLanguage = line.trim().substring(3).trim();
          inCodeBlock = true;
        }
        continue;
      }

      if (inCodeBlock) {
        codeBlock.push(line);
        continue;
      }

      // Headings (markdown style)
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        if (currentParagraph.length > 0) {
          elements.push({
            type: 'paragraph',
            text: currentParagraph.join('\n')
          });
          currentParagraph = [];
        }
        elements.push({
          type: 'heading',
          text: headingMatch[2],
          level: headingMatch[1].length
        });
        continue;
      }

      // Tables (simple detection)
      if (line.includes('|') && line.split('|').length >= 3) {
        if (currentParagraph.length > 0) {
          elements.push({
            type: 'paragraph',
            text: currentParagraph.join('\n')
          });
          currentParagraph = [];
        }
        // Collect full table
        const tableLines = [line];
        while (i + 1 < lines.length && lines[i + 1].includes('|')) {
          i++;
          tableLines.push(lines[i]);
        }
        elements.push({
          type: 'table',
          text: tableLines.join('\n')
        });
        continue;
      }

      // Lists (bullet or numbered)
      const listMatch = line.match(/^\s*[-*+]\s+(.+)$/) || line.match(/^\s*\d+\.\s+(.+)$/);
      if (listMatch) {
        // Treat lists as paragraphs for now (could be enhanced)
        currentParagraph.push(line);
        continue;
      }

      // Regular paragraph
      if (line.trim().length > 0) {
        currentParagraph.push(line);
      } else if (currentParagraph.length > 0) {
        // Empty line - end paragraph
        elements.push({
          type: 'paragraph',
          text: currentParagraph.join('\n')
        });
        currentParagraph = [];
      }
    }

    // Flush remaining content
    if (currentParagraph.length > 0) {
      elements.push({
        type: 'paragraph',
        text: currentParagraph.join('\n')
      });
    }
    if (inCodeBlock && codeBlock.length > 0) {
      elements.push({
        type: 'code',
        text: codeBlock.join('\n'),
        metadata: { language: codeLanguage }
      });
    }

    return elements;
  }

  /**
   * Split text at sentence boundaries
   */
  private splitAtSentences(text: string, maxTokens: number): string[] {
    const sentences = text.split(/(?<=[.!?])\s+/);
    const chunks: string[] = [];
    let current = '';

    for (const sentence of sentences) {
      const candidate = current ? current + ' ' + sentence : sentence;
      if (this.estimateTokens(candidate) > maxTokens && current) {
        chunks.push(current);
        current = sentence;
      } else {
        current = candidate;
      }
    }

    if (current) {
      chunks.push(current);
    }

    return chunks;
  }

  /**
   * Main chunking function with adaptive strategy
   */
  async chunkDocument(
    text: string,
    metadata?: Record<string, any>
  ): Promise<Array<{
    content: string;
    index: number;
    startChar: number;
    endChar: number;
    metadata: any;
  }>> {
    const totalTokens = this.estimateTokens(text);
    const config = this.chooseChunkConfig(totalTokens);
    
    logger.info(`Adaptive chunking: ${totalTokens} tokens → ${config.sizeClass} (target: ${config.target}, overlap: ${config.overlap})`);

    // For tiny documents, return single chunk
    if (config.sizeClass === 'tiny') {
      return [{
        content: text,
        index: 0,
        startChar: 0,
        endChar: text.length,
        metadata: {
          sizeClass: config.sizeClass,
          totalTokens,
          chunkTarget: config.target,
          chunkOverlap: config.overlap,
          retrievalK: config.retrievalK,
          wordCount: text.split(/\s+/).length,
          characterCount: text.length,
          ...metadata
        }
      }];
    }

    // Parse document into structured elements
    const elements = this.parseElements(text);
    const chunks: Array<any> = [];
    let buffer: DocumentElement[] = [];
    let bufferTokens = 0;
    let currentHeading = '';
    let charPosition = 0;

    const flushBuffer = (startPos: number) => {
      if (buffer.length === 0) return;

      const chunkText = buffer.map(el => {
        if (el.type === 'heading') {
          return `# ${el.text}`;
        }
        return el.text;
      }).join('\n\n');

      chunks.push({
        content: (currentHeading ? `[Context: ${currentHeading}]\n\n` : '') + chunkText,
        index: chunks.length,
        startChar: startPos,
        endChar: charPosition,
        metadata: {
          sizeClass: config.sizeClass,
          heading: currentHeading,
          elementTypes: buffer.map(b => b.type),
          chunkTarget: config.target,
          chunkOverlap: config.overlap,
          retrievalK: config.retrievalK,
          wordCount: chunkText.split(/\s+/).length,
          characterCount: chunkText.length,
          ...metadata
        }
      });

      buffer = [];
      bufferTokens = 0;
    };

    let bufferStartPos = 0;

    for (const element of elements) {
      const elementTokens = this.estimateTokens(element.text);
      const elementStartPos = charPosition;
      charPosition += element.text.length + 2; // +2 for \n\n separator

      // Update heading context
      if (element.type === 'heading') {
        currentHeading = element.text;
      }

      // Handle large elements (tables, code blocks)
      if ((element.type === 'table' || element.type === 'code') && elementTokens > config.target * 1.5) {
        // Flush current buffer
        if (buffer.length > 0) {
          flushBuffer(bufferStartPos);
          bufferStartPos = elementStartPos;
        }
        
        // Create shadow summary for large element
        const lines = element.text.split('\n');
        const previewLines = Math.min(15, lines.length);
        const shadow = lines.slice(0, previewLines).join('\n');
        
        const shadowNote = lines.length > previewLines 
          ? `\n... (${lines.length - previewLines} more lines omitted for brevity)` 
          : '';
        
        chunks.push({
          content: (currentHeading ? `[Context: ${currentHeading}]\n\n` : '') + 
                   `[${element.type.toUpperCase()} - ${element.metadata?.language || 'Preview'}]\n${shadow}${shadowNote}`,
          index: chunks.length,
          startChar: elementStartPos,
          endChar: charPosition,
          metadata: {
            sizeClass: config.sizeClass,
            heading: currentHeading,
            elementType: `${element.type}_shadow`,
            isShadow: true,
            originalLines: lines.length,
            chunkTarget: config.target,
            chunkOverlap: config.overlap,
            retrievalK: config.retrievalK,
            ...metadata
          }
        });
        
        bufferStartPos = charPosition;
        continue;
      }

      // Check if adding this element would exceed target
      if (bufferTokens + elementTokens > config.target && buffer.length > 0) {
        flushBuffer(bufferStartPos);
        bufferStartPos = elementStartPos;
      }

      buffer.push(element);
      bufferTokens += elementTokens;
    }

    // Flush remaining
    if (buffer.length > 0) {
      flushBuffer(bufferStartPos);
    }

    // Add overlap between chunks (use last sentences from previous chunk)
    for (let i = 1; i < chunks.length; i++) {
      const prevChunk = chunks[i - 1].content;
      const sentences = prevChunk.split(/(?<=[.!?])\s+/);
      
      // Get last 2 sentences or up to overlap token limit
      let overlapText = '';
      for (let j = sentences.length - 1; j >= 0 && j >= sentences.length - 3; j--) {
        const candidate = sentences.slice(j).join(' ');
        if (this.estimateTokens(candidate) <= config.overlap) {
          overlapText = candidate;
        } else {
          break;
        }
      }
      
      if (overlapText.length > 0) {
        chunks[i].content = `[...continued from previous]\n${overlapText}\n\n${chunks[i].content}`;
      }
    }

    logger.info(`Created ${chunks.length} adaptive chunks from ${elements.length} elements (${config.sizeClass} document)`);
    return chunks;
  }
}

export const adaptiveChunker = new AdaptiveChunker();

