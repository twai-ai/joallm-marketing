// Utilities for exporting chat conversations
import { Message } from '../types';

export function exportChatAsMarkdown(messages: Message[], sessionTitle: string): void {
  let markdown = `# ${sessionTitle}\n\n`;
  markdown += `Exported on ${new Date().toLocaleString()}\n\n---\n\n`;

  messages.forEach((message) => {
    if (message.role === 'system') return; // Skip system messages
    
    const sender = message.role === 'user' ? '**You**' : `**AI** (${message.model || 'Assistant'})`;
    const timestamp = new Date(message.timestamp).toLocaleString();
    
    markdown += `### ${sender}\n`;
    markdown += `*${timestamp}*\n\n`;
    markdown += `${message.content}\n\n`;
    markdown += `---\n\n`;
  });

  downloadFile(markdown, `${sanitizeFilename(sessionTitle)}.md`, 'text/markdown');
}

export function exportChatAsJSON(messages: Message[], sessionTitle: string): void {
  const exportData = {
    title: sessionTitle,
    exportedAt: new Date().toISOString(),
    messageCount: messages.length,
    messages: messages.map((msg) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
      model: msg.model,
      attachments: msg.attachments,
    })),
  };

  const json = JSON.stringify(exportData, null, 2);
  downloadFile(json, `${sanitizeFilename(sessionTitle)}.json`, 'application/json');
}

export function exportChatAsText(messages: Message[], sessionTitle: string): void {
  let text = `${sessionTitle}\n`;
  text += `Exported on ${new Date().toLocaleString()}\n`;
  text += `${'='.repeat(60)}\n\n`;

  messages.forEach((message) => {
    if (message.role === 'system') return;
    
    const sender = message.role === 'user' ? 'You' : `AI (${message.model || 'Assistant'})`;
    const timestamp = new Date(message.timestamp).toLocaleString();
    
    text += `[${timestamp}] ${sender}:\n`;
    text += `${message.content}\n\n`;
    text += `${'-'.repeat(60)}\n\n`;
  });

  downloadFile(text, `${sanitizeFilename(sessionTitle)}.txt`, 'text/plain');
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-z0-9]/gi, '_')
    .replace(/_+/g, '_')
    .toLowerCase()
    .substring(0, 50);
}


