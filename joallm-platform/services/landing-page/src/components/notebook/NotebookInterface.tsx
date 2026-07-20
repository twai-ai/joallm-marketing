import React, { useState, useRef } from 'react';
import { Plus, Play, Save, Download, Code, Type, Image as ImageIcon, BarChart3, Database, Bot, Bug, Upload, FileText, X, CheckCircle } from 'lucide-react';
import { RoleBasedAccess } from '../auth/RoleBasedAccess';

type CellType = 'markdown' | 'code' | 'ai' | 'chart' | 'knowledge' | 'agent' | 'debug';

interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  status: 'uploading' | 'processing' | 'ready' | 'error';
  chunks?: number;
}

interface Cell {
  id: string;
  type: CellType;
  content: string;
  output?: string;
  isExecuting?: boolean;
  documents?: Document[];
  ragConfig?: {
    chunkSize: number;
    overlap: number;
    embeddingModel: string;
    searchTopK: number;
  };
}

export function NotebookInterface() {
  const [cells, setCells] = useState<Cell[]>([
    {
      id: '1',
      type: 'markdown',
      content: '# joallm.ai Notebook\n\nWelcome to your Swiss Army Knife of LLMs! This notebook environment combines the power of traditional notebooks with multi-model AI assistance.',
    },
    {
      id: '2',
      type: 'ai',
      content: 'Analyze the following data and provide insights:',
      output: 'Based on the data analysis, I can see several interesting patterns:\n\n1. **Trend Analysis**: There\'s a clear upward trend in the metrics over time\n2. **Seasonal Patterns**: The data shows cyclical behavior with peaks in Q4\n3. **Outliers**: Several data points deviate significantly from the mean\n\n**Recommendations**:\n- Focus on Q4 strategies to maximize the seasonal peaks\n- Investigate the cause of outliers for potential optimization\n- Consider implementing predictive models based on the trend patterns',
    },
    {
      id: '3',
      type: 'knowledge',
      content: 'Upload and manage documents for RAG-enhanced AI responses',
      output: '📄 Knowledge Base Status:\n• 3 documents indexed\n• 127 chunks processed\n• Ready for AI queries with context',
      documents: [
        { id: 'doc1', name: 'company_report.pdf', type: 'pdf', size: 2048000, status: 'ready', chunks: 45 },
        { id: 'doc2', name: 'user_manual.docx', type: 'docx', size: 1024000, status: 'ready', chunks: 32 },
        { id: 'doc3', name: 'data_analysis.csv', type: 'csv', size: 512000, status: 'ready', chunks: 50 }
      ],
      ragConfig: {
        chunkSize: 1000,
        overlap: 200,
        embeddingModel: 'text-embedding-ada-002',
        searchTopK: 5
      }
    },
  ]);
  
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cellIcons = {
    markdown: Type,
    code: Code,
    ai: BarChart3,
    chart: BarChart3,
    knowledge: Database,
    agent: Bot,
    debug: Bug,
  };

  const addCell = (type: CellType, afterId?: string) => {
    const newCell: Cell = {
      id: `cell-${Date.now()}`,
      type,
      content: type === 'markdown' ? '# New Section\n\nEdit this cell...' : 
               type === 'ai' ? 'Ask the AI assistant...' :
               type === 'chart' ? '// Chart configuration' :
               type === 'knowledge' ? 'Upload documents or connect data sources for enhanced AI context...' :
               type === 'agent' ? 'Define your AI agent behavior and capabilities...' :
               'Debug and trace AI workflow execution...',
    };

    if (afterId) {
      const index = cells.findIndex(cell => cell.id === afterId);
      const newCells = [...cells];
      newCells.splice(index + 1, 0, newCell);
      setCells(newCells);
    } else {
      setCells([...cells, newCell]);
    }
    
    setSelectedCell(newCell.id);
  };

  const updateCell = (id: string, content: string) => {
    setCells(cells.map(cell => 
      cell.id === id ? { ...cell, content } : cell
    ));
  };

  const handleFileUpload = (cellId: string, files: FileList) => {
    const newDocuments: Document[] = Array.from(files).map(file => ({
      id: `doc-${Date.now()}-${Math.random()}`,
      name: file.name,
      type: file.type || file.name.split('.').pop() || 'unknown',
      size: file.size,
      status: 'uploading' as const
    }));

    setCells(cells.map(cell => 
      cell.id === cellId 
        ? { 
            ...cell, 
            documents: [...(cell.documents || []), ...newDocuments]
          } 
        : cell
    ));

    // Simulate file processing
    setTimeout(() => {
      setCells(cells.map(cell => 
        cell.id === cellId 
          ? { 
              ...cell, 
              documents: cell.documents?.map(doc => 
                newDocuments.some(nd => nd.id === doc.id) 
                  ? { ...doc, status: 'processing' as const }
                  : doc
              )
            } 
          : cell
      ));
    }, 1000);

    setTimeout(() => {
      setCells(cells.map(cell => 
        cell.id === cellId 
          ? { 
              ...cell, 
              documents: cell.documents?.map(doc => 
                newDocuments.some(nd => nd.id === doc.id) 
                  ? { ...doc, status: 'ready' as const, chunks: Math.floor(Math.random() * 50) + 10 }
                  : doc
              )
            } 
          : cell
      ));
    }, 3000);
  };

  const removeDocument = (cellId: string, docId: string) => {
    setCells(cells.map(cell => 
      cell.id === cellId 
        ? { 
            ...cell, 
            documents: cell.documents?.filter(doc => doc.id !== docId)
          } 
        : cell
    ));
  };

  const executeCell = async (id: string) => {
    const cell = cells.find(c => c.id === id);
    if (!cell) return;

    setCells(cells.map(c => 
      c.id === id ? { ...c, isExecuting: true } : c
    ));

    // Simulate execution
    await new Promise(resolve => setTimeout(resolve, 1500));

    let output = '';
    if (cell.type === 'ai') {
      output = `AI Response: Based on your query "${cell.content}", here are the key insights and recommendations...`;
    } else if (cell.type === 'code') {
      output = '✓ Code executed successfully\nResult: 42';
    } else if (cell.type === 'chart') {
      output = '[Chart would be rendered here]';
    } else if (cell.type === 'knowledge') {
      const docCount = cell.documents?.length || 0;
      const totalChunks = cell.documents?.reduce((sum, doc) => sum + (doc.chunks || 0), 0) || 0;
      output = `📄 Knowledge Base Updated:\n• ${docCount} documents processed and indexed\n• ${totalChunks} chunks generated\n• Vector embeddings created\n• Ready for context-aware AI queries`;
    } else if (cell.type === 'agent') {
      output = '🤖 Agent Created:\n• Capabilities: Web search, data analysis, code generation\n• Memory: Conversation history enabled\n• Tools: Calculator, file reader, API caller\n• Status: Ready for deployment';
    } else if (cell.type === 'debug') {
      output = '🔍 Debug Trace:\n• Step 1: User query processed ✓\n• Step 2: Knowledge retrieval (3 docs found) ✓\n• Step 3: LLM inference (GPT-4, 1.2s) ✓\n• Step 4: Response generation ✓\n• Total execution time: 2.1s';
    }

    setCells(cells.map(c => 
      c.id === id ? { ...c, output, isExecuting: false } : c
    ));
  };

  const renderCell = (cell: Cell) => {
    const Icon = cellIcons[cell.type];
    const isSelected = selectedCell === cell.id;

    return (
      <div
        key={cell.id}
        className={`group border rounded-lg transition-all ${
          isSelected ? 'border-blue-300 shadow-md' : 'border-gray-200 hover:border-gray-300'
        }`}
        onClick={() => setSelectedCell(cell.id)}
      >
        {/* Cell Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center space-x-2">
            <Icon className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700 capitalize">
              {cell.type} Cell
            </span>
          </div>
          
          <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                executeCell(cell.id);
              }}
              className="p-1 rounded hover:bg-gray-200 transition-colors"
              title="Execute Cell"
            >
              <Play className="w-4 h-4 text-gray-600" />
            </button>
            
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  // Show add cell menu
                }}
                className="p-1 rounded hover:bg-gray-200 transition-colors"
                title="Add Cell Below"
              >
                <Plus className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Cell Content */}
        <div className="p-4">
          {cell.type === 'markdown' && !isSelected ? (
            <div className="prose prose-sm max-w-none">
              {cell.content.split('\n').map((line, i) => {
                if (line.startsWith('# ')) {
                  return <h1 key={i} className="text-xl font-bold mb-2">{line.slice(2)}</h1>;
                } else if (line.startsWith('## ')) {
                  return <h2 key={i} className="text-lg font-semibold mb-2">{line.slice(3)}</h2>;
                } else {
                  return <p key={i} className="mb-2">{line}</p>;
                }
              })}
            </div>
          ) : (
            <textarea
              value={cell.content}
              onChange={(e) => updateCell(cell.id, e.target.value)}
              className={`w-full min-h-[100px] resize-none border-0 focus:outline-none focus:ring-0 ${
                cell.type === 'code' ? 'font-mono text-sm' : ''
              }`}
              placeholder={`Enter ${cell.type} content...`}
            />
          )}
          
          {cell.type === 'knowledge' && (
            <div className="space-y-4">
              {/* File Upload Area */}
              <div 
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleFileUpload(cell.id, e.dataTransfer.files);
                }}
                onDragOver={(e) => e.preventDefault()}
              >
                <Database className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600 mb-2">Drop files here or click to upload</p>
                <button 
                  type="button"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors"
                >
                  Browse Files
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.txt,.md,.markdown,.csv,.html,.xml,.rtf,.jpg,.jpeg,.png,.gif,.webp,.bmp,.tiff,.svg,.zip,.rar,.7z,.json,.yaml,.yml,.js,.ts,.py,.java,.c,.cpp,.cs,.php,.rb,.go,.rs,.sql,.epub,.mobi,.vcf,.msg,.eml"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) {
                      handleFileUpload(cell.id, e.target.files);
                    }
                  }}
                />
              </div>

              {/* Uploaded Documents */}
              {cell.documents && cell.documents.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700">Uploaded Documents</h4>
                  {cell.documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <FileText className="w-4 h-4 text-gray-500" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                          <p className="text-xs text-gray-500">
                            {(doc.size / 1024).toFixed(1)} KB • {doc.chunks ? `${doc.chunks} chunks` : 'Processing...'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {doc.status === 'uploading' && (
                          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        )}
                        {doc.status === 'processing' && (
                          <div className="w-4 h-4 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin" />
                        )}
                        {doc.status === 'ready' && (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        )}
                        {doc.status === 'error' && (
                          <X className="w-4 h-4 text-red-600" />
                        )}
                        <button
                          onClick={() => removeDocument(cell.id, doc.id)}
                          className="p-1 hover:bg-gray-200 rounded transition-colors"
                        >
                          <X className="w-3 h-3 text-gray-500" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* RAG Configuration */}
              {cell.ragConfig && (
                <div className="space-y-3 p-4 bg-blue-50 rounded-lg">
                  <h4 className="text-sm font-medium text-blue-900">RAG Configuration</h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-blue-700">Chunk Size:</span>
                      <span className="ml-1 text-blue-900">{cell.ragConfig.chunkSize}</span>
                    </div>
                    <div>
                      <span className="text-blue-700">Overlap:</span>
                      <span className="ml-1 text-blue-900">{cell.ragConfig.overlap}</span>
                    </div>
                    <div>
                      <span className="text-blue-700">Embedding Model:</span>
                      <span className="ml-1 text-blue-900">{cell.ragConfig.embeddingModel}</span>
                    </div>
                    <div>
                      <span className="text-blue-700">Search Top-K:</span>
                      <span className="ml-1 text-blue-900">{cell.ragConfig.searchTopK}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="text-sm text-gray-600">
                <p className="font-medium mb-1">Supported formats:</p>
                <p>PDF, DOCX, TXT, CSV, Markdown</p>
              </div>
            </div>
          )}
          
          {cell.type === 'agent' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Agent Name</label>
                <input
                  type="text"
                  placeholder="e.g., Data Analysis Assistant"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Agent Role & Instructions</label>
                <textarea
                  placeholder="You are a helpful assistant that specializes in..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Available Tools</label>
                <div className="grid grid-cols-2 gap-2">
                  {['Web Search', 'Calculator', 'Code Interpreter', 'File Reader', 'API Caller', 'Image Generator'].map((tool) => (
                    <label key={tool} className="flex items-center space-x-2">
                      <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                      <span className="text-sm text-gray-700">{tool}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {cell.type === 'debug' && (
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <button className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors">
                  Start Trace
                </button>
                <button className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-md text-sm hover:bg-gray-300 transition-colors">
                  Clear Logs
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Debug Target</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option>Current Workflow</option>
                  <option>Specific Agent</option>
                  <option>Knowledge Retrieval</option>
                  <option>Model Performance</option>
                </select>
              </div>
              <div className="bg-gray-900 text-green-400 p-3 rounded-md font-mono text-sm">
                <div>🔍 Debug Console Ready</div>
                <div className="text-gray-500">Waiting for execution trace...</div>
              </div>
            </div>
          )}
          
          {/* Cell Output */}
          {cell.output && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="bg-gray-50 rounded-md p-3">
                {cell.isExecuting ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-gray-600">Executing...</span>
                  </div>
                ) : (
                  <div className="prose prose-sm max-w-none">
                    <pre className="whitespace-pre-wrap text-sm">{cell.output}</pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <RoleBasedAccess module="notebook">
      <div className="h-full flex flex-col">
      {/* Notebook Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">joallm.ai Notebook</h2>
          <p className="text-sm text-gray-600">Interactive multi-model AI notebook environment</p>
        </div>
        
        <div className="flex items-center space-x-2">
          <button className="flex items-center space-x-2 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors">
            <Save className="w-4 h-4" />
            <span>Save</span>
          </button>
          
          <button className="flex items-center space-x-2 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors">
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
        </div>
      </div>
      
      {/* Notebook Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {cells.map(renderCell)}
          
          {/* Add Cell Button */}
          <div className="flex justify-center pt-4">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => addCell('markdown')}
                className="flex items-center space-x-2 px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors"
              >
                <Type className="w-4 h-4" />
                <span className="text-sm">Text</span>
              </button>
              
              <button
                onClick={() => addCell('code')}
                className="flex items-center space-x-2 px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors"
              >
                <Code className="w-4 h-4" />
                <span className="text-sm">Code</span>
              </button>
              
              <button
                onClick={() => addCell('ai')}
                className="flex items-center space-x-2 px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors"
              >
                <BarChart3 className="w-4 h-4" />
                <span className="text-sm">AI</span>
              </button>
              
              <button
                onClick={() => addCell('knowledge')}
                className="flex items-center space-x-2 px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors"
              >
                <Database className="w-4 h-4" />
                <span className="text-sm">Knowledge</span>
              </button>
              
              <button
                onClick={() => addCell('agent')}
                className="flex items-center space-x-2 px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors"
              >
                <Bot className="w-4 h-4" />
                <span className="text-sm">Agent</span>
              </button>
              
              <button
                onClick={() => addCell('debug')}
                className="flex items-center space-x-2 px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors"
              >
                <Bug className="w-4 h-4" />
                <span className="text-sm">Debug</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>
    </RoleBasedAccess>
  );
}