import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Play, Save, Download, Code, Type, BarChart3, Database, Bot, Bug, FileText, X, CheckCircle, Loader2, Trash2 } from 'lucide-react';
import { RoleBasedAccess } from '../auth/RoleBasedAccess';
import { notebookApi } from '../../services/notebookApi';
import { API_ENDPOINTS } from '../../config/api';
import { storage, STORAGE_KEYS } from '../../utils/storage';
import { showSuccess, showError } from '../../utils/toast';
import { useNavigate, useParams } from 'react-router-dom';
import { useUserRole } from '../../contexts/EnhancedUserRoleContext';
import { useWorkflow } from '../../contexts/WorkflowContext';
import { buildWorkflowFromNotebook } from '../workflow/workflowTemplates';
import { cx, notebookCellTone, workspaceBadge, workspaceButton, workspaceHeader, workspaceInput, workspacePanel, workspacePanelMuted, workspaceSectionLabel, workspaceShell, workspaceTextarea, workspaceTitle } from '../workspace/workspaceTheme';

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
  attachedDocumentIds?: string[];
  ragConfig?: {
    chunkSize: number;
    overlap: number;
    embeddingModel: string;
    searchTopK: number;
  };
}

export function NotebookInterface() {
  const { notebookId } = useParams<{ notebookId?: string }>();
  const navigate = useNavigate();
  const { subscriptionTier, limits } = useUserRole();
  const { workflows, createWorkflowFromDefinition } = useWorkflow();
  const [cells, setCells] = useState<Cell[]>([]);
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [currentNotebookId, setCurrentNotebookId] = useState<string | null>(notebookId || null);
  const [notebookTitle, setNotebookTitle] = useState('Untitled Notebook');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunningSequence, setIsRunningSequence] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [addMenuForCell, setAddMenuForCell] = useState<string | null>(null);
  const unsupportedCellTypes = new Set<CellType>(['chart', 'agent', 'debug']);

  // Load notebook on mount
  useEffect(() => {
    loadNotebook();
  }, [notebookId]);

  // Auto-save debounced
  useEffect(() => {
    if (currentNotebookId && cells.length > 0 && !isLoading) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      autoSaveTimeoutRef.current = setTimeout(() => {
        handleSave(true); // silent save
      }, 3000);
    }
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [cells, currentNotebookId]);

  const loadNotebook = async () => {
    setIsLoading(true);
    try {
      if (notebookId) {
        // Load existing notebook
        const data = await notebookApi.getNotebook(notebookId);
        setNotebookTitle(data.notebook.title);
        setCells(data.cells.map(cell => ({
          id: cell.id,
          type: cell.cellType,
          content: cell.content,
          output: cell.output || undefined,
          documents: [],
          attachedDocumentIds: cell.attachedDocuments,
          ragConfig: cell.ragConfig,
        })));
        setCurrentNotebookId(data.notebook.id);
      } else {
        // Create new notebook with default cells
        const newNotebook = await notebookApi.createNotebook({
          title: 'Untitled Notebook',
          description: 'New notebook',
        });
        setCurrentNotebookId(newNotebook.id);
        setNotebookTitle(newNotebook.title);
        
        // Add default welcome cell
        const welcomeCell = await notebookApi.addCell(newNotebook.id, {
          cellType: 'markdown',
          content: '# joallm.ai Notebook\n\nWelcome to your Swiss Army Knife of LLMs! This notebook environment combines the power of traditional notebooks with multi-model AI assistance.',
          position: 0,
        });
        
        setCells([{
          id: welcomeCell.id,
          type: 'markdown',
          content: welcomeCell.content,
        }]);
      }
    } catch (error) {
      console.error('Failed to load notebook:', error);
      showError('Failed to load notebook', error instanceof Error ? error.message : undefined);
      // Fall back to empty notebook
      setCells([{
        id: '1',
        type: 'markdown',
        content: '# New Notebook\n\nStart editing...',
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (silent = false) => {
    if (!currentNotebookId) return;

    try {
      setIsSaving(true);
      
      // Update notebook title
      await notebookApi.updateNotebook(currentNotebookId, {
        title: notebookTitle,
      });

      // Update all cells
      await Promise.all(
        cells.map(async (cell, index) => {
          try {
            await notebookApi.updateCell(currentNotebookId!, cell.id, {
              content: cell.content,
              output: cell.output,
              position: index,
            });
          } catch (error) {
            console.error(`Failed to save cell ${cell.id}:`, error);
          }
        })
      );

      if (!silent) {
        showSuccess('Notebook saved successfully');
      }
    } catch (error) {
      console.error('Failed to save notebook:', error);
      if (!silent) {
        showError('Failed to save notebook');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const cellIcons = {
    markdown: Type,
    code: Code,
    ai: BarChart3,
    chart: BarChart3,
    knowledge: Database,
    agent: Bot,
    debug: Bug,
  };

  const addCell = async (type: CellType, afterId?: string) => {
    if (!currentNotebookId) return;

    const content = type === 'markdown'
      ? '# New Section\n\nEdit this cell...'
      : type === 'ai'
        ? 'Ask Chat...'
        : type === 'knowledge'
          ? 'Upload documents or connect data sources for enhanced AI context...'
          : '// Enter code';

    const position = afterId 
      ? cells.findIndex(cell => cell.id === afterId) + 1
      : cells.length;

    try {
      const newCell = await notebookApi.addCell(currentNotebookId, {
        cellType: type,
        content,
        position,
      });

      const cellData: Cell = {
        id: newCell.id,
        type: newCell.cellType,
        content: newCell.content,
        output: newCell.output || undefined,
      };

      if (afterId) {
        const index = cells.findIndex(cell => cell.id === afterId);
        const newCells = [...cells];
        newCells.splice(index + 1, 0, cellData);
        setCells(newCells);
      } else {
        setCells([...cells, cellData]);
      }
      
      setSelectedCell(newCell.id);
    } catch (error) {
      console.error('Failed to add cell:', error);
      showError('Failed to add cell');
    }
  };

  const updateCell = (id: string, content: string) => {
    setCells((current) => current.map(cell => 
      cell.id === id ? { ...cell, content } : cell
    ));
  };

  const deleteCell = async (id: string) => {
    if (!currentNotebookId || cells.length === 1) {
      showError('A notebook needs at least one cell');
      return;
    }

    try {
      await notebookApi.deleteCell(currentNotebookId, id);
      setCells((current) => current.filter((cell) => cell.id !== id));
      if (selectedCell === id) {
        setSelectedCell(null);
      }
      showSuccess('Cell deleted');
    } catch (error) {
      console.error('Failed to delete cell:', error);
      showError('Failed to delete cell');
    }
  };

  const handleFileUpload = useCallback(async (cellId: string, fileList: FileList) => {
    const token = storage.getSecure<string>(STORAGE_KEYS.AUTH_TOKEN);
    const filesToUpload = Array.from(fileList);

    // Optimistically add uploading placeholders
    const placeholders: Document[] = filesToUpload.map(file => ({
      id: `uploading-${Date.now()}-${Math.random()}`,
      name: file.name,
      type: file.type || file.name.split('.').pop() || 'unknown',
      size: file.size,
      status: 'uploading' as const,
    }));

    setCells(prev => prev.map(cell =>
      cell.id === cellId
        ? { ...cell, documents: [...(cell.documents || []), ...placeholders] }
        : cell
    ));

    // Upload each file and collect real IDs
    const uploadedIds: string[] = [];
    const finalDocs: Document[] = [];

    await Promise.all(filesToUpload.map(async (file, idx) => {
      const placeholder = placeholders[idx];
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(API_ENDPOINTS.files.upload, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });
        if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
        const data = await res.json();
        const fileId: string = data.fileId ?? data.id;
        uploadedIds.push(fileId);
        finalDocs.push({ ...placeholder, id: fileId, status: 'processing' as const });
      } catch (err) {
        console.error('File upload error:', err);
        showError(`Failed to upload ${file.name}`);
        finalDocs.push({ ...placeholder, status: 'error' as const });
      }
    }));

    // Replace placeholders with real documents
    setCells(prev => prev.map(cell =>
      cell.id === cellId
        ? {
            ...cell,
            documents: [
              ...(cell.documents || []).filter(d => !placeholders.some(p => p.id === d.id)),
              ...finalDocs,
            ],
            attachedDocumentIds: [...(cell.attachedDocumentIds || []), ...uploadedIds],
          }
        : cell
    ));

    // Persist real file IDs to the cell's attachedDocuments via backend if we have a notebook
    if (currentNotebookId && uploadedIds.length > 0) {
      try {
        const existingCell = cells.find(c => c.id === cellId);
        const existingIds = existingCell?.attachedDocumentIds ?? [];
        await notebookApi.updateCell(currentNotebookId, cellId, {
          attachedDocuments: [...existingIds, ...uploadedIds],
        });
      } catch (err) {
        console.error('Failed to persist attachedDocuments:', err);
      }
    }
  }, [cells, currentNotebookId]);

  const removeDocument = (cellId: string, docId: string) => {
    setCells((current) => current.map(cell => 
      cell.id === cellId 
        ? { 
            ...cell, 
            documents: cell.documents?.filter(doc => doc.id !== docId),
            attachedDocumentIds: cell.attachedDocumentIds?.filter(id => id !== docId),
          } 
        : cell
    ));
  };

  const handlePromoteToWorkflow = async () => {
    if (typeof limits?.maxWorkflows === 'number' && Number.isFinite(limits.maxWorkflows) && workflows.length >= limits.maxWorkflows) {
      showError(`Your ${subscriptionTier} plan allows up to ${limits.maxWorkflows} workflows. Upgrade to create more.`);
      return;
    }

    try {
      const definition = buildWorkflowFromNotebook(notebookTitle, cells);
      const created = await createWorkflowFromDefinition(definition);
      showSuccess('Notebook promoted to a draft workflow. Review the generated steps before sharing it.');
      navigate(`/workflow/${created.id}`);
    } catch (error) {
      console.error('Failed to promote notebook to workflow:', error);
      showError('Failed to create a workflow from this notebook');
    }
  };

  const executeCell = async (id: string) => {
    if (!currentNotebookId) return;
    const targetCell = cells.find((cell) => cell.id === id);
    if (!targetCell) return;
    if (unsupportedCellTypes.has(targetCell.type)) {
      showError('This legacy cell type is disabled until runtime support is available');
      return;
    }

    setCells(cells.map(c => 
      c.id === id ? { ...c, isExecuting: true } : c
    ));

    try {
      const executed = await notebookApi.executeCell(currentNotebookId, id);
      
      setCells(cells.map(c => 
        c.id === id 
          ? { 
              ...c, 
              isExecuting: false,
              output: executed.output || 'Executed',
            }
          : c
      ));
    } catch (error) {
      console.error('Failed to execute cell:', error);
      setCells(cells.map(c => 
        c.id === id 
          ? { 
              ...c, 
              isExecuting: false,
              output: 'Execution failed',
            }
          : c
      ));
      showError('Failed to execute cell');
    }
  };

  const runCellSequence = async (cellIds: string[], successMessage: string) => {
    if (!currentNotebookId || cellIds.length === 0) return;

    setIsRunningSequence(true);
    try {
      for (const cellId of cellIds) {
        // eslint-disable-next-line no-await-in-loop
        await executeCell(cellId);
      }
      showSuccess(successMessage);
    } finally {
      setIsRunningSequence(false);
    }
  };

  const handleRunAll = async () => {
    await runCellSequence(
      cells.filter((cell) => !unsupportedCellTypes.has(cell.type)).map((cell) => cell.id),
      'Notebook run completed'
    );
  };

  const handleRunToSelected = async () => {
    if (!selectedCell) {
      showError('Select a cell first to run up to that point');
      return;
    }

    const selectedIndex = cells.findIndex((cell) => cell.id === selectedCell);
    if (selectedIndex < 0) return;

    await runCellSequence(
      cells
        .slice(0, selectedIndex + 1)
        .filter((cell) => !unsupportedCellTypes.has(cell.type))
        .map((cell) => cell.id),
      'Notebook run completed up to the selected cell'
    );
  };

  const renderCell = (cell: Cell) => {
    const Icon = cellIcons[cell.type];
    const isSelected = selectedCell === cell.id;
    const isUnsupportedCell = unsupportedCellTypes.has(cell.type);
    const addableCellTypes: Array<{ type: CellType; label: string; icon: React.ElementType }> = [
      { type: 'markdown', label: 'Text', icon: Type },
      { type: 'code', label: 'Code', icon: Code },
      { type: 'ai', label: 'AI', icon: BarChart3 },
      { type: 'knowledge', label: 'Knowledge', icon: Database },
    ];

    return (
      <div
        key={cell.id}
        className={cx(
          'group rounded-3xl border transition-all overflow-hidden shadow-[0_14px_32px_rgba(15,23,42,0.06)]',
          isSelected ? 'border-blue-300 bg-white shadow-[0_18px_40px_rgba(37,99,235,0.14)]' : 'border-slate-200 hover:border-slate-300 bg-white/88',
          notebookCellTone[cell.type]
        )}
        onClick={() => setSelectedCell(cell.id)}
      >
        {/* Cell Header */}
        <div className="flex items-center justify-between border-b border-slate-200/80 bg-white/70 px-4 py-3 backdrop-blur-sm">
          <div className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <Icon className="w-4 h-4" />
            </div>
            <span className="text-sm font-medium text-slate-700 capitalize">
              {cell.type} Cell
            </span>
            {isUnsupportedCell && (
              <span className={workspaceBadge.warn}>
                Disabled
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                executeCell(cell.id);
              }}
              disabled={isUnsupportedCell}
              className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40"
              title="Execute Cell"
            >
              <Play className="w-4 h-4 text-gray-600" />
            </button>
            
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setAddMenuForCell((current) => (current === cell.id ? null : cell.id));
                }}
                className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                title="Add Cell Below"
              >
                <Plus className="w-4 h-4 text-gray-600" />
              </button>
              {addMenuForCell === cell.id && (
                <div className="absolute right-0 top-10 z-20 min-w-44 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                  {addableCellTypes.map((item) => (
                    <button
                      key={item.type}
                      onClick={(e) => {
                        e.stopPropagation();
                        void addCell(item.type, cell.id);
                        setAddMenuForCell(null);
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <item.icon className="w-4 h-4" />
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                void deleteCell(cell.id);
              }}
              className="rounded-xl p-2 text-rose-500 transition-colors hover:bg-rose-50"
              title="Delete Cell"
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </button>
          </div>
        </div>
        
        {/* Cell Content */}
        <div className="p-5">
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
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.shiftKey) {
                  e.preventDefault();
                  void executeCell(cell.id);
                }
              }}
              className={cx(
                'w-full min-h-[100px] resize-none border-0 bg-transparent p-0 focus:outline-none focus:ring-0',
                cell.type === 'code' ? 'font-mono text-sm text-slate-100 placeholder:text-slate-400' : 'text-slate-800'
              )}
              placeholder={`Enter ${cell.type} content...`}
            />
          )}
          
          {isUnsupportedCell && (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              This legacy cell type is disabled until runtime support is available.
            </div>
          )}

          {cell.type === 'knowledge' && (
            <div className="space-y-4">
              {/* File Upload Area */}
              <div 
                className="cursor-pointer rounded-2xl border-2 border-dashed border-slate-300 bg-white/75 p-6 text-center transition-colors hover:border-blue-400"
                onClick={() => fileInputRef.current?.click()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleFileUpload(cell.id, e.dataTransfer.files);
                }}
                onDragOver={(e) => e.preventDefault()}
              >
                <Database className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="mb-2 text-sm text-slate-600">Drop files here or click to upload</p>
                <button 
                  type="button"
                  className={workspaceButton.accent}
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
                  <h4 className="text-sm font-medium text-slate-700">Uploaded Documents</h4>
                  {cell.documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3">
                      <div className="flex items-center space-x-3">
                        <FileText className="w-4 h-4 text-gray-500" />
                        <div>
                          <p className="text-sm font-medium text-slate-900">{doc.name}</p>
                          <p className="text-xs text-slate-500">
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
                          className="rounded-lg p-1 transition-colors hover:bg-slate-100"
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
                <div className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
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

              <div className="text-sm text-slate-600">
                <p className="font-medium mb-1">Supported formats:</p>
                <p>PDF, DOCX, TXT, CSV, Markdown</p>
              </div>
            </div>
          )}
          
          {/* Cell Output */}
          {cell.output && (
            <div className="mt-4 border-t border-slate-200 pt-4">
              <div className="rounded-2xl bg-slate-50 p-4">
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

  if (isLoading) {
    return (
      <RoleBasedAccess module="notebook">
        <div className="h-full flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </RoleBasedAccess>
    );
  }

  return (
    <RoleBasedAccess module="notebook">
      <div className={workspaceShell}>
      {/* Notebook Header */}
      <div className={cx(workspaceHeader, 'flex items-center justify-between')}>
        <div className="flex-1">
          <p className={workspaceSectionLabel}>Notebook workspace</p>
          <input
            type="text"
            value={notebookTitle}
            onChange={(e) => setNotebookTitle(e.target.value)}
            className="mt-1 bg-transparent text-lg font-semibold text-slate-900 outline-none transition placeholder:text-slate-400"
            placeholder="Notebook Title"
          />
          <p className="text-sm text-slate-600">Interactive multi-model AI notebook environment</p>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className={workspaceBadge.neutral}>
            Plan: {subscriptionTier}
          </span>
          {typeof limits?.maxNotebooks === 'number' && Number.isFinite(limits.maxNotebooks) ? (
            <span className={workspaceBadge.accent}>
              Notebook limit: {limits.maxNotebooks}
            </span>
          ) : null}
          <button
            onClick={() => void handleRunAll()}
            disabled={isRunningSequence || cells.length === 0}
            className={workspaceButton.success}
          >
            {isRunningSequence ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            <span>Run All</span>
          </button>
          <button
            onClick={() => void handleRunToSelected()}
            disabled={isRunningSequence || !selectedCell}
            className={workspaceButton.primary}
          >
            <Play className="w-4 h-4" />
            <span>Run To Selected</span>
          </button>
          <button 
            onClick={() => handleSave(false)}
            disabled={isSaving}
            className={workspaceButton.accent}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save</span>
              </>
            )}
          </button>
          
          <button 
            onClick={() => showSuccess('Export feature coming soon!')}
            className={workspaceButton.secondary}
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
          <button
            onClick={() => void handlePromoteToWorkflow()}
            className={`${workspaceButton.primary} bg-violet-600 hover:bg-violet-700`}
          >
            <Bot className="w-4 h-4" />
            <span>Create Workflow</span>
          </button>
        </div>
      </div>

      <div className="border-b border-blue-100 bg-blue-50/80 px-5 py-3 text-sm text-blue-900">
        Use notebooks as a chain-of-thought workspace. AI and knowledge cells can reference earlier cell outputs with
        <code className="mx-1 rounded bg-white px-1.5 py-0.5 text-xs text-blue-800">{'{{cell-id.output}}'}</code>
        or
        <code className="mx-1 rounded bg-white px-1.5 py-0.5 text-xs text-blue-800">{'{{previous}}'}</code>
        so good analysis can be turned into repeatable work later.
      </div>
      
      {/* Notebook Content */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-4xl mx-auto space-y-4">
          {cells.map(renderCell)}
          
          {/* Add Cell Button */}
          <div className="flex justify-center pt-4">
            <div className={cx(workspacePanel, 'flex flex-wrap items-center gap-2 p-3')}>
              <button
                onClick={() => addCell('markdown')}
                className={workspaceButton.secondary}
              >
                <Type className="w-4 h-4" />
                <span className="text-sm">Text</span>
              </button>
              
              <button
                onClick={() => addCell('code')}
                className={workspaceButton.secondary}
              >
                <Code className="w-4 h-4" />
                <span className="text-sm">Code</span>
              </button>
              
              <button onClick={() => addCell('ai')} className={workspaceButton.secondary}>
                <BarChart3 className="w-4 h-4" />
                <span className="text-sm">AI</span>
              </button>
              
              <button
                onClick={() => addCell('knowledge')}
                className={workspaceButton.secondary}
              >
                <Database className="w-4 h-4" />
                <span className="text-sm">Knowledge</span>
              </button>
              
            </div>
          </div>
        </div>
      </div>
      </div>
    </RoleBasedAccess>
  );
}
