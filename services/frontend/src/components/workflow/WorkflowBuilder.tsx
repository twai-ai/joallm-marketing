import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Film, Layers, Loader2, PanelLeftClose, PanelLeftOpen, Play, Plus, Save, Settings, Sparkles, XCircle, Clock3, LayoutDashboard, ListChecks } from 'lucide-react';
import { useParams, useSearchParams } from 'react-router-dom';
import { WorkflowCanvas } from './WorkflowCanvas';
import { NodePalette } from './NodePalette';
import { WorkflowSettings } from './WorkflowSettings';
import { WorkflowNodeSettings } from './WorkflowNodeSettings';
import { workflowNodePaletteTypes, mediaNodePaletteTypes, isMediaWorkflowNodeType, type WorkflowNodeType } from './workflowNodeCatalog';
import { MediaStatusPanel } from './MediaStatusPanel';
import { getMediaIntelligenceModeLabel } from '../../constants/mediaIntelligenceModes';
import { useWorkflow } from '../../contexts/WorkflowContext';
import { RoleBasedAccess } from '../auth/RoleBasedAccess';
import { workflowApi } from '../../services/workflowApi';
import { showSuccess, showError } from '../../utils/toast';
import { useUserRole } from '../../contexts/EnhancedUserRoleContext';
import { workflowStarterTemplates, type WorkflowStarterTemplate } from './workflowTemplates';
import { cx, workspaceBadge, workspaceButton, workspaceHeader, workspaceInput, workspacePanel, workspacePanelMuted, workspaceSectionLabel, workspaceShell, workspaceTitle } from '../workspace/workspaceTheme';

function formatElapsedDuration(startedAt?: string, completedAt?: string, nowMs?: number): string {
  if (!startedAt) return 'Not started';

  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : (nowMs ?? Date.now());
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return 'Unknown duration';
  }

  const totalSeconds = Math.max(0, Math.floor((end - start) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  return `${seconds}s`;
}

function executionTimestamp(execution: { startedAt: string }): number {
  return new Date(execution.startedAt).getTime();
}

export function WorkflowBuilder() {
  const { workflowId } = useParams<{ workflowId?: string }>();
  const [searchParams] = useSearchParams();
  const [showSettings, setShowSettings] = useState(false);
  const [showPalette, setShowPalette] = useState(true);
  const [paletteMode, setPaletteMode] = useState<'custom' | 'media'>(
    searchParams.get('mode') === 'media' ? 'media' : 'custom'
  );
  const [showInspector, setShowInspector] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [recentExecutions, setRecentExecutions] = useState<Awaited<ReturnType<typeof workflowApi.getExecutions>>>([]);
  const [isLoadingExecutions, setIsLoadingExecutions] = useState(false);
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [configuredNodeId, setConfiguredNodeId] = useState<string | null>(null);
  const [pendingAddNodeType, setPendingAddNodeType] = useState<WorkflowNodeType | null>(null);
  const [draggedNodeType, setDraggedNodeType] = useState<WorkflowNodeType | null>(null);
  const [showNameInput, setShowNameInput] = useState(false);
  const [pendingName, setPendingName] = useState('');
  const [mediaWorkspaceTab, setMediaWorkspaceTab] = useState<'overview' | 'runs' | 'results' | 'settings'>('overview');
  const [runTimerNow, setRunTimerNow] = useState(() => Date.now());
  const nameInputRef = useRef<HTMLInputElement>(null);
  const hydratedWorkflowIdsRef = useRef<Set<string>>(new Set());
  const executionPollTimerRef = useRef<number | null>(null);
  const executionPollFailureCountRef = useRef(0);
  const { activeWorkflow, workflows, setActiveWorkflow, createWorkflow, createWorkflowFromDefinition, updateWorkflow, updateNode } = useWorkflow();
  const { subscriptionTier, limits } = useUserRole();

  const normalizeWorkflowGraph = (workflow: Awaited<ReturnType<typeof workflowApi.getWorkflow>>) => {
    const nodes = Array.isArray(workflow.nodes) ? workflow.nodes : [];
    const edges = Array.isArray(workflow.edges) ? workflow.edges : [];

    return {
      nodes: nodes.map((node: any) => ({
        ...node,
        name:
          typeof node?.name === 'string' && node.name.trim().length > 0
            ? node.name
            : String(node?.type || 'Node')
                .replace(/_/g, ' ')
                .replace(/\b\w/g, (char) => char.toUpperCase()),
        position: {
          x: typeof node?.position?.x === 'number' ? node.position.x : 80,
          y: typeof node?.position?.y === 'number' ? node.position.y : 120,
        },
        data: node?.data && typeof node.data === 'object' ? node.data : {},
        connections: Array.isArray(node?.connections) ? node.connections : [],
      })),
      edges,
    };
  };

  const mapApiWorkflow = (workflow: Awaited<ReturnType<typeof workflowApi.getWorkflow>>) => ({
    ...normalizeWorkflowGraph(workflow),
    id: workflow.id,
    name: workflow.name,
    description: workflow.description || '',
    created: new Date(workflow.createdAt),
    modified: new Date(workflow.updatedAt),
    isPublic: workflow.isPublic,
    isTemplate: workflow.isTemplate,
  });

  const loadExecutions = async (workflowId: string) => {
    try {
      setIsLoadingExecutions(true);
      const executions = await workflowApi.getExecutions(workflowId);
      setRecentExecutions(executions);
      setSelectedExecutionId((current) => current ?? executions[0]?.id ?? null);
    } catch (error) {
      console.error('Failed to load workflow executions:', error);
    } finally {
      setIsLoadingExecutions(false);
    }
  };

  useEffect(() => {
    if (activeWorkflow?.id) {
      void loadExecutions(activeWorkflow.id);
    } else {
      setRecentExecutions([]);
      setSelectedExecutionId(null);
    }
  }, [activeWorkflow?.id]);

  useEffect(() => {
    if (!workflowId) return;
    const matchingWorkflow = workflows.find((workflow) => workflow.id === workflowId);
    const activeNodeCount = Array.isArray(activeWorkflow?.nodes) ? activeWorkflow.nodes.length : 0;
    const matchingNodeCount = Array.isArray(matchingWorkflow?.nodes) ? matchingWorkflow.nodes.length : 0;

    if (
      matchingWorkflow &&
      (
        matchingWorkflow.id !== activeWorkflow?.id ||
        activeNodeCount === 0 && matchingNodeCount > 0
      )
    ) {
      setActiveWorkflow(matchingWorkflow);
    }
  }, [workflowId, workflows, activeWorkflow?.id, setActiveWorkflow]);

  useEffect(() => {
    if (!workflowId) return;

    if (hydratedWorkflowIdsRef.current.has(workflowId)) {
      return;
    }

    let cancelled = false;

    const loadWorkflow = async () => {
      try {
        const workflow = await workflowApi.getWorkflow(workflowId);
        if (!cancelled) {
          hydratedWorkflowIdsRef.current.add(workflowId);
          setActiveWorkflow(mapApiWorkflow(workflow));
        }
      } catch (error) {
        console.error(`Failed to load workflow ${workflowId}:`, error);
      }
    };

    void loadWorkflow();

    return () => {
      cancelled = true;
    };
  }, [workflowId, setActiveWorkflow]);

  useEffect(() => {
    if (showNameInput) {
      setTimeout(() => nameInputRef.current?.focus(), 50);
    }
  }, [showNameInput]);

  useEffect(() => {
    return () => {
      if (executionPollTimerRef.current != null) {
        window.clearTimeout(executionPollTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const hasActiveRun = recentExecutions.some(
      (execution) => execution.status === 'running' || execution.status === 'suspended',
    );
    if (!hasActiveRun) return;

    const interval = window.setInterval(() => setRunTimerNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [recentExecutions]);

  const openNameInput = () => {
    if (typeof limits?.maxWorkflows === 'number' && Number.isFinite(limits.maxWorkflows) && workflows.length >= limits.maxWorkflows) {
      showError(`Your ${subscriptionTier} plan allows up to ${limits.maxWorkflows} workflows. Upgrade to create more.`);
      return;
    }
    setPendingName('');
    setShowNameInput(true);
  };

  const confirmNewWorkflow = () => {
    const name = pendingName.trim();
    if (!name) return;
    setShowNameInput(false);
    createWorkflow(name, 'New AI workflow').catch(err => showError(err.message || 'Failed to create workflow'));
  };

  const handleCreateFromTemplate = async (template: WorkflowStarterTemplate) => {
    if (typeof limits?.maxWorkflows === 'number' && Number.isFinite(limits.maxWorkflows) && workflows.length >= limits.maxWorkflows) {
      showError(`Your ${subscriptionTier} plan allows up to ${limits.maxWorkflows} workflows. Upgrade to create more.`);
      return;
    }
    try {
      await createWorkflowFromDefinition(template);
      showSuccess(`"${template.name}" loaded — tune the prompts to fit your use case`);
    } catch (error) {
      showError('Failed to create workflow from template');
    }
  };

  const handleSave = async () => {
    if (!activeWorkflow) { showError('No workflow to save'); return; }
    try {
      setIsSaving(true);
      await updateWorkflow(activeWorkflow);
      showSuccess('Workflow saved');
    } catch (error) {
      showError('Failed to save workflow');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRun = async () => {
    if (!activeWorkflow) { showError('No workflow to execute'); return; }
    if (!activeWorkflow.id) { showError('Save the workflow before running it'); return; }
    try {
      setIsExecuting(true);
      executionPollFailureCountRef.current = 0;
      if (executionPollTimerRef.current != null) {
        window.clearTimeout(executionPollTimerRef.current);
        executionPollTimerRef.current = null;
      }
      const execution = await workflowApi.executeWorkflow(activeWorkflow.id);
      showSuccess(`Run started`);
      await loadExecutions(activeWorkflow.id);
      const checkStatus = async () => {
        try {
          const status = await workflowApi.getExecutionStatus(execution.id);
          executionPollFailureCountRef.current = 0;
          setRecentExecutions((current) => current.map((item) => item.id === status.id ? status : item));
          if (status.status === 'completed') {
            showSuccess('Workflow completed');
            setIsExecuting(false);
            if (activeWorkflow?.id) await loadExecutions(activeWorkflow.id);
          } else if (status.status === 'failed') {
            showError(`Workflow failed: ${status.error || 'Unknown error'}`);
            setIsExecuting(false);
            if (activeWorkflow?.id) await loadExecutions(activeWorkflow.id);
          } else if (status.status === 'running' || status.status === 'suspended') {
            executionPollTimerRef.current = window.setTimeout(checkStatus, 3000);
          }
        } catch (error) {
          executionPollFailureCountRef.current += 1;
          if (executionPollFailureCountRef.current >= 3) {
            setIsExecuting(false);
            showError('Lost connection while checking workflow status. Please refresh the run panel in a moment.');
            return;
          }

          const retryDelay = 4000 * executionPollFailureCountRef.current;
          executionPollTimerRef.current = window.setTimeout(checkStatus, retryDelay);
        }
      };
      executionPollTimerRef.current = window.setTimeout(checkStatus, 3000);
    } catch (error) {
      showError('Failed to execute workflow');
      setIsExecuting(false);
    }
  };

  const handleCancelExecution = async (executionId: string) => {
    try {
      await workflowApi.cancelExecution(executionId);
      showSuccess('Run cancelled');
      if (activeWorkflow?.id) await loadExecutions(activeWorkflow.id);
    } catch {
      showError('Failed to cancel run');
    }
  };

  const selectedExecution = recentExecutions.find((e) => e.id === selectedExecutionId) ?? recentExecutions[0] ?? null;
  const configuredNode = activeWorkflow?.nodes.find((n) => n.id === configuredNodeId) || null;
  const mediaModeActive = paletteMode === 'media' || searchParams.get('mode') === 'media';
  const mediaWorkflowNodes = useMemo(
    () => activeWorkflow?.nodes.filter((node) => isMediaWorkflowNodeType(node.type)) ?? [],
    [activeWorkflow?.nodes]
  );
  const mediaFileNode = useMemo(
    () => mediaWorkflowNodes.find((node) => node.data?.fileId) ?? null,
    [mediaWorkflowNodes]
  );
  const mediaInsightNode = useMemo(
    () => mediaWorkflowNodes.find((node) => node.type === 'media_insights') ?? mediaFileNode,
    [mediaWorkflowNodes, mediaFileNode]
  );
  const latestRuns = recentExecutions.slice(0, 5);
  const latestExecution = recentExecutions[0] ?? null;
  const activeRun = [...recentExecutions]
    .filter((execution) => execution.status === 'running' || execution.status === 'suspended')
    .sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'running' ? -1 : 1;
      }
      return executionTimestamp(b) - executionTimestamp(a);
    })[0] ?? null;
  const overviewExecution = activeRun ?? latestExecution ?? selectedExecution;
  const isManagedMediaWorkflow = mediaModeActive && Boolean(mediaFileNode?.data?.fileId);

  const executionTone = overviewExecution?.status === 'failed'
    ? 'border-rose-200 bg-rose-50 text-rose-700'
    : overviewExecution?.status === 'completed'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : overviewExecution?.status === 'suspended'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-sky-200 bg-sky-50 text-sky-700';

  const executionSummary = overviewExecution?.status === 'failed'
    ? overviewExecution.error || 'The latest run failed.'
    : overviewExecution?.status === 'completed'
      ? 'The latest run finished successfully.'
      : overviewExecution?.status === 'suspended'
        ? 'Waiting on a background media task. The run will continue automatically.'
        : overviewExecution?.status === 'running'
          ? 'The workflow is actively running.'
          : 'Run the workflow to start processing.';

  const shouldShowPipelineLayout = !mediaModeActive;
  const shouldShowRightPanel = shouldShowPipelineLayout && (Boolean(configuredNode) || showSettings);

  const mediaWorkspaceTabs: Array<{
    id: 'overview' | 'runs' | 'results' | 'settings';
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'runs', label: 'Runs', icon: ListChecks },
    { id: 'results', label: 'Results', icon: Sparkles },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const renderExecutionList = () => {
    if (isLoadingExecutions) {
      return (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-4 py-5 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading runs…
        </div>
      );
    }

    if (recentExecutions.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white/70 px-4 py-5 text-center text-sm text-slate-500">
          No runs yet. Press <span className="font-semibold text-slate-700">Run</span> above to start.
        </div>
      );
    }

    return (
      <>
        {recentExecutions.slice(0, 5).map((execution) => (
          <button
            key={execution.id}
            onClick={() => setSelectedExecutionId(execution.id)}
            className={cx(
              'w-full rounded-xl border px-3 py-2.5 text-left transition',
              selectedExecution?.id === execution.id
                ? 'border-blue-300 bg-blue-50 shadow-sm'
                : 'border-slate-200 bg-white/85 hover:bg-white'
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium text-slate-800 font-mono">{execution.id.slice(0, 8)}</span>
              <span className={cx(
                'rounded-full px-2 py-0.5 text-[11px] font-semibold shrink-0',
                execution.status === 'completed' ? 'bg-emerald-100 text-emerald-700'
                  : execution.status === 'failed' ? 'bg-red-100 text-red-700'
                  : execution.status === 'cancelled' ? 'bg-slate-200 text-slate-600'
                  : execution.status === 'suspended' ? 'bg-violet-100 text-violet-700'
                  : 'bg-amber-100 text-amber-700'
              )}>
                {execution.status}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
              <Clock3 className="h-3 w-3" />
              {new Date(execution.startedAt).toLocaleString()}
            </div>
            <p className="mt-1 text-[11px] font-mono text-slate-400">
              {formatElapsedDuration(execution.startedAt, execution.completedAt, runTimerNow)}
            </p>
          </button>
        ))}
      </>
    );
  };

  const renderExecutionDetail = () => {
    if (!selectedExecution) {
      return <p className="text-sm text-slate-500">Select a run on the left to see logs and outputs.</p>;
    }

    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h4 className="text-sm font-semibold font-mono text-slate-900">
              Run {selectedExecution.id.slice(0, 8)}
            </h4>
            <p className="text-xs text-slate-500">
              {new Date(selectedExecution.startedAt).toLocaleString()}
              {selectedExecution.completedAt ? ` → ${new Date(selectedExecution.completedAt).toLocaleString()}` : ''}
            </p>
            <p className="mt-1 font-mono text-xs text-slate-400">
              {formatElapsedDuration(selectedExecution.startedAt, selectedExecution.completedAt, runTimerNow)}
            </p>
          </div>
          {(selectedExecution.status === 'running' || selectedExecution.status === 'suspended') && (
            <button
              onClick={() => void handleCancelExecution(selectedExecution.id)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
            >
              <XCircle className="h-3.5 w-3.5" />
              Cancel
            </button>
          )}
        </div>

        {selectedExecution.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
            {selectedExecution.error}
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Node log</p>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {(selectedExecution.executionLog || []).length === 0 ? (
              <div className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-500">
                No node log available yet.
              </div>
            ) : (
              (selectedExecution.executionLog || []).map((entry, index) => (
                <div key={`${entry.nodeId}-${index}`} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-slate-800">{entry.nodeId}</span>
                    <span className={cx(
                      'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                      entry.status === 'completed' ? 'bg-emerald-100 text-emerald-700'
                        : entry.status === 'failed' ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                    )}>
                      {entry.status}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{entry.message}</p>
                  {entry.output && (
                    <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700">
                      {JSON.stringify(entry.output, null, 2)}
                    </pre>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <RoleBasedAccess module="workflow">
      <div className={cx(workspaceShell, 'h-full flex')}>

        {/* ── Left palette ──────────────────────────────────────────────── */}
        {shouldShowPipelineLayout && showPalette && (
          <div className="w-64 shrink-0 border-r border-slate-200/80 bg-white/70 flex flex-col">
            {/* Palette mode tabs */}
            <div className="flex border-b border-slate-200/80 bg-white/90">
              <button
                onClick={() => setPaletteMode('custom')}
                aria-pressed={paletteMode === 'custom'}
                className={cx(
                  'flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors',
                  paletteMode === 'custom'
                    ? 'border-b-2 border-blue-500 text-blue-700 bg-white'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                )}
              >
                <Layers className="w-3.5 h-3.5" />
                Custom
              </button>
              <button
                onClick={() => setPaletteMode('media')}
                aria-pressed={paletteMode === 'media'}
                className={cx(
                  'flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors',
                  paletteMode === 'media'
                    ? 'border-b-2 border-teal-500 text-teal-700 bg-white'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                )}
              >
                <Film className="w-3.5 h-3.5" />
                Media AI
              </button>
            </div>
            <NodePalette
              nodeTypes={paletteMode === 'media' ? mediaNodePaletteTypes : workflowNodePaletteTypes}
              onAddNode={(nodeType) => {
                if (!activeWorkflow) {
                  showError('Create or open a workflow first before adding nodes');
                  return;
                }
                setPendingAddNodeType(nodeType as WorkflowNodeType);
              }}
              onDragNodeStart={(nodeType) => setDraggedNodeType(nodeType as WorkflowNodeType)}
              onDragNodeEnd={() => setDraggedNodeType(null)}
            />
          </div>
        )}

        {/* ── Main canvas area ───────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* Header */}
          <div className={cx(workspaceHeader, 'flex items-center justify-between gap-3')}>
            <div className="flex items-center gap-2 min-w-0">
              {/* Toggle palette */}
              <button
                onClick={() => setShowPalette(!showPalette)}
                title={showPalette ? 'Hide node palette' : 'Show node palette'}
                aria-label={showPalette ? 'Hide node palette' : 'Show node palette'}
                className={workspaceButton.secondary}
              >
                {showPalette
                  ? <PanelLeftClose className="w-4 h-4" />
                  : <PanelLeftOpen className="w-4 h-4" />}
              </button>

              <div className="min-w-0">
                <p className={workspaceSectionLabel}>Workflow builder</p>
                <h2 className={cx(workspaceTitle, 'truncate')}>
                  {activeWorkflow ? activeWorkflow.name : 'joallm.ai Workflow Builder'}
                </h2>
              </div>

              <span className={workspaceBadge.neutral}>{subscriptionTier}</span>

              {typeof limits?.maxWorkflows === 'number' && Number.isFinite(limits.maxWorkflows) && (
                <span className={workspaceBadge.accent}>
                  {workflows.length}/{limits.maxWorkflows} workflows
                </span>
              )}

              {/* Inline new-workflow input */}
              {!activeWorkflow && (
                showNameInput ? (
                  <div className="flex items-center gap-2">
                    <input
                      ref={nameInputRef}
                      type="text"
                      value={pendingName}
                      onChange={(e) => setPendingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') confirmNewWorkflow();
                        if (e.key === 'Escape') setShowNameInput(false);
                      }}
                      placeholder="Workflow name…"
                      className={cx(workspaceInput, 'w-48 text-sm')}
                    />
                    <button
                      onClick={confirmNewWorkflow}
                      disabled={!pendingName.trim()}
                      className={workspaceButton.accent}
                    >
                      Create
                    </button>
                    <button onClick={() => setShowNameInput(false)} className={workspaceButton.secondary}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button onClick={openNameInput} className={workspaceButton.accent}>
                    <Plus className="w-4 h-4" />
                    New workflow
                  </button>
                )
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleRun}
                disabled={!activeWorkflow || !activeWorkflow.id || isExecuting || isManagedMediaWorkflow}
                className={cx(
                  workspaceButton.success,
                  isManagedMediaWorkflow && 'cursor-not-allowed opacity-60',
                )}
                title={
                  !activeWorkflow
                    ? 'Open a workflow to run it'
                    : isManagedMediaWorkflow
                      ? 'Managed media workflows run from Knowledge/Media AI and should not be manually re-run here.'
                      : undefined
                }
              >
                {isExecuting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /><span>Running…</span></>
                ) : (
                  <><Play className="w-4 h-4" /><span>{isManagedMediaWorkflow ? 'Managed' : 'Run'}</span></>
                )}
              </button>

              <button
                onClick={handleSave}
                disabled={!activeWorkflow || isSaving}
                className={workspaceButton.accent}
                title={!activeWorkflow ? 'Open a workflow to save it' : undefined}
              >
                {isSaving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /><span>Saving…</span></>
                ) : (
                  <><Save className="w-4 h-4" /><span>Save</span></>
                )}
              </button>

              <button
                onClick={() => {
                  if (mediaModeActive) {
                    setMediaWorkspaceTab('settings');
                  } else {
                    setShowSettings(!showSettings);
                    setConfiguredNodeId(null);
                  }
                }}
                aria-pressed={mediaModeActive ? mediaWorkspaceTab === 'settings' : showSettings}
                className={cx(workspaceButton.secondary, showSettings && 'bg-slate-100 text-slate-900')}
                title="Workflow settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          {mediaModeActive && (
            <div className="border-b border-slate-200/70 bg-gradient-to-r from-cyan-50 via-white to-teal-50">
              <div className="px-4 py-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Media AI workspace</p>
                    <p className="mt-1 text-xs text-slate-500">
                      This workspace is built around uploads, runs, results, and settings for the active media workflow.
                    </p>
                  </div>
                  <div className={cx('rounded-xl border px-3 py-2 text-xs font-medium', executionTone)}>
                    <div className="flex items-center gap-2">
                      <Clock3 className="h-3.5 w-3.5" />
                      <span>
                        {overviewExecution ? `Latest run: ${overviewExecution.status}` : 'Latest run: idle'}
                      </span>
                    </div>
                    <p className="mt-1 max-w-md text-[11px] font-normal leading-5 opacity-90">
                      {executionSummary}
                    </p>
                  </div>
                </div>
              </div>
              <div className="border-t border-slate-200/70 px-4">
                <div className="flex flex-wrap gap-2 py-3">
                  {mediaWorkspaceTabs.map((tab) => {
                    const Icon = tab.icon;
                    const active = mediaWorkspaceTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setMediaWorkspaceTab(tab.id);
                          if (tab.id !== 'settings') setShowSettings(false);
                        }}
                        className={cx(
                          'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition',
                          active
                            ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                            : 'text-slate-600 hover:bg-white/80'
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {mediaModeActive && !shouldShowPipelineLayout && (
            <div className="flex-1 overflow-y-auto bg-slate-50/40 px-4 py-4">
              {mediaWorkspaceTab === 'overview' && (
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_360px]">
                  <div className="space-y-4">
                    <div className={cx(workspacePanel, 'p-5')}>
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className={workspaceSectionLabel}>Media workflow</p>
                          <h3 className="text-xl font-semibold text-slate-900">
                            {mediaFileNode?.data?.filename || activeWorkflow?.name || 'Media analysis'}
                          </h3>
                          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                            This workspace is optimized for uploads, execution progress, and structured results without exposing the workflow graph.
                          </p>
                          {isManagedMediaWorkflow && (
                            <p className="mt-2 text-xs leading-5 text-slate-500">
                              This media file is managed from Knowledge/Media AI. Manual reruns are disabled here so the guided ingest flow remains the source of truth.
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => setMediaWorkspaceTab('results')} className={workspaceButton.secondary}>
                            View results
                          </button>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current run</p>
                          <p className="mt-2 text-lg font-semibold text-slate-900">{overviewExecution?.status || 'Idle'}</p>
                          <p className="mt-1 text-sm text-slate-500">{executionSummary}</p>
                          <p className="mt-2 text-xs font-mono text-slate-400">
                            {overviewExecution
                              ? `Elapsed: ${formatElapsedDuration(overviewExecution.startedAt, overviewExecution.completedAt, runTimerNow)}`
                              : 'Elapsed: —'}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Audit trail</p>
                          <p className="mt-2 text-lg font-semibold text-slate-900">{latestRuns.length}</p>
                          <p className="mt-1 text-sm text-slate-500">Showing the last five runs with status, timestamps, and elapsed time.</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active model</p>
                          <p className="mt-2 text-lg font-semibold text-slate-900">{String(mediaInsightNode?.data?.model || 'Default')}</p>
                          <p className="mt-1 text-sm text-slate-500">
                            {getMediaIntelligenceModeLabel(String(mediaInsightNode?.data?.intelligenceMode || 'balanced'))} mode on the Media Insights step.
                          </p>
                        </div>
                      </div>
                    </div>

                    {mediaFileNode?.data?.fileId ? (
                      <div className={cx(workspacePanel, 'p-0 overflow-hidden')}>
                        <MediaStatusPanel
                          fileId={mediaFileNode.data.fileId}
                          processingStage={mediaFileNode.data.processingStage}
                          filename={mediaFileNode.data.filename}
                          showExtendedResults={false}
                        />
                      </div>
                    ) : (
                      <div className={cx(workspacePanelMuted, 'p-5')}>
                        <p className="text-sm text-slate-600">Attach a media file to see transcript and insight progress here.</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className={cx(workspacePanel, 'p-4')}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className={workspaceSectionLabel}>Recent runs</p>
                          <h4 className="text-sm font-semibold text-slate-900">Run history</h4>
                        </div>
                        {activeWorkflow?.id && (
                          <button
                            onClick={() => void loadExecutions(activeWorkflow.id)}
                            className={cx(workspaceButton.secondary, 'text-xs')}
                          >
                            Refresh
                          </button>
                        )}
                      </div>
                      <div className="mt-3 space-y-2">
                        {latestRuns.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
                            No runs yet. Start the workflow to populate this workspace.
                          </div>
                        ) : (
                          latestRuns.map((execution) => (
                            <button
                              key={execution.id}
                              onClick={() => {
                                setSelectedExecutionId(execution.id);
                                setMediaWorkspaceTab('runs');
                              }}
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-slate-300 hover:shadow-sm"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="font-mono text-sm font-medium text-slate-900">{execution.id.slice(0, 8)}</span>
                                <span className={cx(
                                  'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                                  execution.status === 'completed' ? 'bg-emerald-100 text-emerald-700'
                                    : execution.status === 'failed' ? 'bg-red-100 text-red-700'
                                    : execution.status === 'suspended' ? 'bg-violet-100 text-violet-700'
                                    : 'bg-amber-100 text-amber-700'
                                )}>
                                  {execution.status}
                                </span>
                              </div>
                              <p className="mt-2 text-xs text-slate-500">{new Date(execution.startedAt).toLocaleString()}</p>
                            </button>
                          ))
                        )}
                      </div>
                    </div>

                    {activeRun && (
                      <div className={cx(workspacePanel, 'p-4')}>
                        <p className={workspaceSectionLabel}>Live audit</p>
                        <h4 className="text-sm font-semibold text-slate-900">Active run timer</h4>
                        <div className="mt-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-medium text-slate-900">Run {activeRun.id.slice(0, 8)}</span>
                            <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                              {activeRun.status}
                            </span>
                          </div>
                          <p className="mt-3 font-mono text-2xl font-semibold text-slate-900">
                            {formatElapsedDuration(activeRun.startedAt, activeRun.completedAt, runTimerNow)}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Started {new Date(activeRun.startedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {mediaWorkspaceTab === 'runs' && (
                <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
                  <div className="space-y-2">{renderExecutionList()}</div>
                  <div className={cx(workspacePanel, 'p-4')}>{renderExecutionDetail()}</div>
                </div>
              )}

              {mediaWorkspaceTab === 'results' && (
                <div className="space-y-4">
                  <div className={cx(workspacePanel, 'p-5')}>
                    <p className={workspaceSectionLabel}>Results</p>
                    <h3 className="text-xl font-semibold text-slate-900">Transcript and insights</h3>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                      Review the current transcript, highlights, topics, and action items here. Results stay cached for this file so switching tabs does not restart analysis.
                    </p>
                  </div>
                  {mediaFileNode?.data?.fileId ? (
                    <div className={cx(workspacePanel, 'p-0 overflow-hidden')}>
                      <MediaStatusPanel
                        fileId={mediaFileNode.data.fileId}
                        processingStage={mediaFileNode.data.processingStage}
                        filename={mediaFileNode.data.filename}
                        showExtendedResults
                      />
                    </div>
                  ) : (
                    <div className={cx(workspacePanelMuted, 'p-5')}>
                      <p className="text-sm text-slate-600">No media file is attached to this workflow yet.</p>
                    </div>
                  )}
                </div>
              )}

              {mediaWorkspaceTab === 'settings' && (
                <div className={cx(workspacePanel, 'p-0 overflow-hidden')}>
                  <WorkflowSettings onClose={() => setMediaWorkspaceTab('overview')} />
                </div>
              )}
            </div>
          )}

          {shouldShowPipelineLayout && (
            <>
              <div className="flex-1 relative overflow-hidden">
                <WorkflowCanvas
                  selectedNodeId={selectedNodeId}
                  onSelectNode={setSelectedNodeId}
                  onConfigureNode={(nodeId) => {
                    setSelectedNodeId(nodeId);
                    setConfiguredNodeId(nodeId);
                    setShowSettings(false);
                  }}
                  pendingAddNodeType={pendingAddNodeType}
                  onPendingAddNodeHandled={() => setPendingAddNodeType(null)}
                  draggedNodeType={draggedNodeType}
                  onDraggedNodeHandled={() => setDraggedNodeType(null)}
                />
              </div>

              {/* ── Execution inspector (collapsible) ─────────────────────── */}
              <div className="border-t border-slate-200/80 bg-white/80 backdrop-blur-xl">
            {/* Inspector header / toggle */}
                <button
                  onClick={() => setShowInspector(!showInspector)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                >
                  <div>
                    <p className={workspaceSectionLabel}>Execution inspector</p>
                    <span className="text-xs text-slate-500">
                      {activeWorkflow
                        ? recentExecutions.length > 0
                          ? `${recentExecutions.length} run${recentExecutions.length !== 1 ? 's' : ''} — click to inspect logs`
                          : 'No runs yet'
                        : 'Open a workflow to see runs'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {activeWorkflow?.id && (
                      <button
                        onClick={(e) => { e.stopPropagation(); void loadExecutions(activeWorkflow.id); }}
                        className={cx(workspaceButton.secondary, 'text-xs')}
                      >
                        Refresh
                      </button>
                    )}
                    {showInspector
                      ? <ChevronDown className="w-4 h-4 text-slate-400" />
                      : <ChevronUp className="w-4 h-4 text-slate-400" />}
                  </div>
                </button>

                {showInspector && (
                  <div className="px-4 pb-4">
                    {!activeWorkflow ? (
                      <div className="space-y-4">
                        <div className={cx(workspacePanelMuted, 'px-4 py-5 text-center')}>
                          <p className="text-sm font-medium text-slate-700">Start with a template</p>
                          <p className="mt-1 text-xs text-slate-500">
                            Pick a prebuilt workflow and tune the prompts for your use case.
                          </p>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          {workflowStarterTemplates.map((template) => (
                            <div key={template.id} className={cx(workspacePanelMuted, 'p-4 flex flex-col')}>
                              <div className="flex items-start justify-between gap-2 mb-1.5">
                                <h5 className="text-sm font-semibold text-slate-900 leading-snug">{template.name}</h5>
                                <span className={cx(workspaceBadge.neutral, 'shrink-0')}>{template.category}</span>
                              </div>
                              <p className="text-xs text-slate-500 flex-1">{template.blurb}</p>
                              <button
                                onClick={() => void handleCreateFromTemplate(template)}
                                className={cx(workspaceButton.accent, 'mt-3 self-start')}
                              >
                                <Sparkles className="h-3.5 w-3.5" />
                                Use template
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
                        <div className="space-y-2">{renderExecutionList()}</div>
                        <div className={cx(workspacePanel, 'p-4')}>{renderExecutionDetail()}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Right settings panel ────────────────────────────────────── */}
        {shouldShowRightPanel && configuredNode ? (
          <div className="w-80 shrink-0 border-l border-slate-200/80 bg-white/70 flex flex-col overflow-y-auto">
            <WorkflowNodeSettings
              node={configuredNode}
              onClose={() => setConfiguredNodeId(null)}
              onUpdate={(data) => updateNode(configuredNode.id, data)}
              availableNodes={activeWorkflow?.nodes.filter(n => n.id !== configuredNode.id) ?? []}
            />
            {isMediaWorkflowNodeType(configuredNode.type) && configuredNode.data?.fileId && (
              <div className="border-t border-slate-200/60">
                <MediaStatusPanel
                  fileId={configuredNode.data.fileId}
                  processingStage={configuredNode.data.processingStage}
                  filename={configuredNode.data.filename}
                  showExtendedResults={false}
                />
              </div>
            )}
          </div>
        ) : shouldShowRightPanel && showSettings && (
          <div className="w-80 shrink-0 border-l border-slate-200/80 bg-white/70">
            <WorkflowSettings onClose={() => setShowSettings(false)} />
          </div>
        )}
      </div>
    </RoleBasedAccess>
  );
}
