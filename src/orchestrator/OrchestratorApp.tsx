import { useEffect, useMemo, useState } from 'preact/hooks'
import { render } from 'preact'
import type { ComponentChildren } from 'preact'
import { OrchestratorEngine, OrchestratorViewState, RunStateView, ScenarioTemplateSummary, WorkerInfoView } from './OrchestratorEngine'
import type { ScenarioEvent, ScenarioRunStatus, ScenarioTemplate, WorkerSlot } from './protocol'

interface Props {
    engine: OrchestratorEngine
}

export function mountOrchestratorApp(engine: OrchestratorEngine) {
    const container = document.createElement('div')
    container.className = 'qcp-orch-root'
    container.style.position = 'fixed'
    container.style.top = '20px'
    container.style.right = '20px'
    container.style.width = '960px'
    container.style.maxHeight = 'calc(100vh - 40px)'
    container.style.overflow = 'auto'
    container.style.zIndex = '10001'
    container.style.background = '#0f172a'
    container.style.color = '#e2e8f0'
    container.style.padding = '12px'
    container.style.borderRadius = '12px'
    container.style.boxShadow = '0 10px 30px rgba(0,0,0,0.45)'
    container.style.fontFamily = 'Inter, system-ui, sans-serif'
    document.body.appendChild(container)
    render(<OrchestratorApp engine={engine} />, container)
    return container
}

function OrchestratorApp({ engine }: Props) {
    const [state, setState] = useState<OrchestratorViewState>(() => engine.getState())
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>(state.templates[0]?.id)
    const [initialArtifact, setInitialArtifact] = useState('')
    const [activeRun, setActiveRun] = useState<RunStateView | null>(state.currentRun)
    const [selectedRound, setSelectedRound] = useState<number | null>(null)

    useEffect(() => {
        return engine.subscribe(next => {
            setState(next)
            setActiveRun(next.currentRun)
            if (!next.currentRun) setSelectedRound(null)
        })
    }, [engine])

    useEffect(() => {
        if (state.templates.length && !selectedTemplateId) setSelectedTemplateId(state.templates[0].id)
    }, [state.templates, selectedTemplateId])

    const selectedTemplate = useMemo(() => engine.getTemplate(selectedTemplateId || ''), [engine, selectedTemplateId, state.templates])

    const handleSelectTemplate = (id: string) => {
        setSelectedTemplateId(id)
        const tpl = engine.getTemplate(id)
        if (tpl && (!state.currentRun || state.currentRun.templateId !== id)) {
            engine.syncSlotsFromTemplate(tpl)
        }
    }

    const startRun = () => {
        if (selectedTemplateId) {
            engine.startRun(selectedTemplateId, initialArtifact)
            setInitialArtifact('')
        }
    }

    const templateSummary = state.templates.find(t => t.id === selectedTemplateId)

    return (
        <div className="qcp-orch-shell" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <HeaderBar
                run={activeRun}
                template={templateSummary}
                workers={state.workers}
                onNameChange={name => engine.setRunName(name)}
            />
            <div className="qcp-orch-layout" style={{ display: 'grid', gridTemplateColumns: '280px 1fr 320px', gap: '10px' }}>
                <div className="qcp-orch-column qcp-orch-column-left" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <RunControlPanel
                        run={activeRun}
                        onStart={startRun}
                        onPause={() => engine.pauseRun()}
                        onStop={() => engine.stopRun()}
                        onResume={() => engine.resumeRun()}
                        onStep={() => engine.step()}
                        initialArtifact={initialArtifact}
                        onInitialArtifactChange={setInitialArtifact}
                    />
                    <ScenarioPanel
                        templates={state.templates}
                        selectedTemplateId={selectedTemplateId}
                        template={selectedTemplate}
                        onSelect={handleSelectTemplate}
                        onSave={tpl => engine.updateTemplate(tpl)}
                    />
                </div>

                <div className="qcp-orch-column qcp-orch-column-center" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <ContentTabs
                        run={activeRun}
                        selectedRound={selectedRound}
                        onSelectRound={setSelectedRound}
                    />
                </div>

                <div className="qcp-orch-column qcp-orch-column-right" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <WorkersPanel
                        workers={state.workers}
                        slots={state.slots}
                        onBind={(slot, workerId) => engine.bindSlot(slot.slotName, workerId)}
                        onPing={workerId => engine.router.sendPing(workerId)}
                    />
                    <LogsPanel
                        events={state.events}
                        runId={activeRun?.id}
                    />
                </div>
            </div>
        </div>
    )
}

function Section({ title, children }: { title: string; children: ComponentChildren }) {
    return (
        <div style={{ background: '#111827', borderRadius: '8px', padding: '10px' }}>
            <div style={{ fontWeight: 700, marginBottom: '6px', fontSize: '13px' }}>{title}</div>
            {children}
        </div>
    )
}

function HeaderBar({
    run,
    template,
    workers,
    onNameChange,
}: {
    run: RunStateView | null
    template?: ScenarioTemplateSummary
    workers: WorkerInfoView[]
    onNameChange: (name: string) => void
}) {
    const idle = workers.filter(w => w.status === 'idle').length
    const busy = workers.filter(w => w.status === 'busy').length
    const error = workers.filter(w => w.status === 'error').length
    const name = run?.name || run?.id || 'No active run'

    return (
        <Section title="Coordinator Header">
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                    style={{ flex: 1, padding: '6px', borderRadius: '6px', border: '1px solid #1f2937', background: '#0b1224', color: '#e5e7eb' }}
                    value={name}
                    onInput={e => onNameChange((e.target as HTMLInputElement).value)}
                    placeholder="Run name"
                />
                <div style={{ padding: '6px 10px', borderRadius: '6px', background: '#1f2937' }}>Template: {template?.name || 'N/A'}</div>
                <StatusBadge status={run?.status || 'idle'} />
                <div style={{ fontSize: '12px' }}>Round {run?.currentRound ?? 0} / {run?.maxRounds ?? template?.maxRounds ?? 0}</div>
                <div style={{ fontSize: '12px' }}>Workers: {workers.length} total / {idle} idle / {busy} busy / {error} error</div>
            </div>
        </Section>
    )
}

function StatusBadge({ status }: { status: ScenarioRunStatus | 'idle' }) {
    const color = status === 'running' ? '#16a34a' : status === 'error' ? '#ef4444' : status === 'paused' ? '#f59e0b' : '#6b7280'
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#0b1224', padding: '4px 8px', borderRadius: '6px', color }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }} />
            {status}
        </span>
    )
}

function RunControlPanel({
    run,
    onStart,
    onPause,
    onStop,
    onResume,
    onStep,
    initialArtifact,
    onInitialArtifactChange,
}: {
    run: RunStateView | null
    onStart: () => void
    onPause: () => void
    onStop: () => void
    onResume: () => void
    onStep: () => void
    initialArtifact: string
    onInitialArtifactChange: (val: string) => void
}) {
    return (
        <Section title="Run Control">
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                <button onClick={onStart} disabled={!!run && run.status === 'running'}>Start</button>
                <button onClick={onResume} disabled={!run || run.status === 'running'}>Resume</button>
                <button onClick={onPause} disabled={!run || run.status !== 'running'}>Pause</button>
                <button onClick={onStop} disabled={!run}>Stop</button>
                <button onClick={onStep} disabled={!run}>Step</button>
            </div>
            <textarea
                style={{ width: '100%', minHeight: '80px', background: '#0b1224', color: '#e5e7eb', borderRadius: '6px', border: '1px solid #1f2937' }}
                placeholder="Initial artifact (optional)"
                value={initialArtifact}
                onInput={e => onInitialArtifactChange((e.target as HTMLTextAreaElement).value)}
            />
            {run && (
                <div style={{ fontSize: '12px', marginTop: '8px', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '4px' }}>
                    <div>Run ID: {run.id}</div>
                    <div>Status: {run.status}</div>
                    <div>Template: {run.templateId}</div>
                    <div>Stage: {run.currentStagePath.join(' / ') || '-'}</div>
                </div>
            )}
        </Section>
    )
}

function ScenarioPanel({
    templates,
    template,
    selectedTemplateId,
    onSelect,
    onSave,
}: {
    templates: ScenarioTemplateSummary[]
    template?: ScenarioTemplate
    selectedTemplateId?: string
    onSelect: (id: string) => void
    onSave: (tpl: ScenarioTemplate) => void
}) {
    const [advanced, setAdvanced] = useState(false)
    const [editing, setEditing] = useState<string>('')

    useEffect(() => {
        if (template) setEditing(JSON.stringify(template, null, 2))
    }, [template])

    const handleSaveJson = () => {
        try {
            const parsed = JSON.parse(editing) as ScenarioTemplate
            if (!parsed.id || !parsed.roles || !parsed.stages) throw new Error('Invalid template schema')
            onSave(parsed)
        }
        catch (error) {
            alert(`Failed to save template: ${error}`)
        }
    }

    return (
        <Section title="Scenario Templates">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <select value={selectedTemplateId} onInput={e => onSelect((e.target as HTMLSelectElement).value)}>
                    {templates.map(t => (
                        <option key={t.id} value={t.id}>
                            {t.name}
                        </option>
                    ))}
                </select>
                {template && !advanced && (
                    <div style={{ fontSize: '12px', lineHeight: 1.5 }}>
                        <div>Description: {template.description || 'N/A'}</div>
                        <div>Roles: {template.roles.map(r => r.slotName).join(', ')}</div>
                        <div>Stages: {template.stages.length}</div>
                        <div>Max rounds: {templates.find(t => t.id === template.id)?.maxRounds ?? 'n/a'}</div>
                        <button onClick={() => setAdvanced(true)} style={{ marginTop: '6px' }}>
                            Edit prompts…
                        </button>
                    </div>
                )}
                {template && advanced && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <textarea
                            style={{ width: '100%', minHeight: '220px', background: '#0b1224', color: '#e5e7eb', borderRadius: '6px', border: '1px solid #1f2937' }}
                            value={editing}
                            onInput={e => setEditing((e.target as HTMLTextAreaElement).value)}
                        />
                        <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={handleSaveJson}>Validate &amp; Save</button>
                            <button onClick={() => setAdvanced(false)}>Close</button>
                        </div>
                        <div style={{ fontSize: '12px', color: '#9ca3af' }}>Hooks placeholder: define beforeRound/afterRound/shouldStop in JSON.</div>
                    </div>
                )}
            </div>
        </Section>
    )
}

function ContentTabs({ run, selectedRound, onSelectRound }: { run: RunStateView | null; selectedRound: number | null; onSelectRound: (round: number | null) => void }) {
    const [tab, setTab] = useState<'artifact' | 'transcript' | 'live'>('artifact')

    useEffect(() => {
        if (run && run.rounds.length && selectedRound === null) {
            onSelectRound(run.rounds[0].round)
        }
    }, [run, selectedRound, onSelectRound])

    return (
        <Section title="Content">
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <button onClick={() => setTab('artifact')} disabled={tab === 'artifact'}>Artifact</button>
                <button onClick={() => setTab('transcript')} disabled={tab === 'transcript'}>Per-round Transcript</button>
                <button onClick={() => setTab('live')} disabled={tab === 'live'}>Live Stream</button>
            </div>
            {tab === 'artifact' && <ArtifactView run={run} />}
            {tab === 'transcript' && (
                <RoundTranscriptView run={run} selectedRound={selectedRound} onSelectRound={onSelectRound} />
            )}
            {tab === 'live' && <LiveStreamView run={run} />}
        </Section>
    )
}

function ArtifactView({ run }: { run: RunStateView | null }) {
    const exportArtifact = () => {
        if (!run) return
        const blob = new Blob([run.centralArtifact], { type: 'text/markdown' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${run.id}.md`
        a.click()
        URL.revokeObjectURL(url)
    }

    const copyArtifact = async () => {
        if (run) await navigator.clipboard.writeText(run.centralArtifact)
    }

    return (
        <div>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                <button onClick={copyArtifact} disabled={!run}>Copy</button>
                <button onClick={exportArtifact} disabled={!run}>Export .md</button>
            </div>
            <div style={{ background: '#0b1224', padding: '8px', whiteSpace: 'pre-wrap', minHeight: '220px', borderRadius: '6px', border: '1px solid #1f2937' }}>
                {run?.centralArtifact || 'No artifact yet'}
            </div>
        </div>
    )
}

function RoundTranscriptView({
    run,
    selectedRound,
    onSelectRound,
}: {
    run: RunStateView | null
    selectedRound: number | null
    onSelectRound: (round: number | null) => void
}) {
    if (!run) return <div>No run started.</div>
    const rounds = run.rounds
    const activeRound = rounds.find(r => r.round === selectedRound) || rounds[rounds.length - 1]

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '8px' }}>
            <div style={{ maxHeight: '320px', overflow: 'auto', background: '#0b1224', borderRadius: '6px', border: '1px solid #1f2937' }}>
                {rounds.map(r => (
                    <div
                        key={r.round}
                        onClick={() => onSelectRound(r.round)}
                        style={{ padding: '6px 8px', cursor: 'pointer', background: r.round === activeRound?.round ? '#1f2937' : 'transparent' }}
                    >
                        Round {r.round}
                    </div>
                ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {activeRound ? (
                    activeRound.roleReplies.map(reply => (
                        <div key={reply.role} style={{ background: '#0b1224', padding: '8px', borderRadius: '6px', border: '1px solid #1f2937' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <div>[{reply.role}]</div>
                                <div style={{ fontSize: '12px', color: reply.ok ? '#16a34a' : '#ef4444' }}>
                                    {reply.ok ? 'ok' : 'error'} {reply.durationMs ? `• ${reply.durationMs} ms` : ''}
                                </div>
                            </div>
                            {reply.summary && <div style={{ marginTop: '4px', color: '#9ca3af' }}>{reply.summary}</div>}
                            <details style={{ marginTop: '4px' }}>
                                <summary style={{ cursor: 'pointer' }}>Full reply</summary>
                                <div style={{ whiteSpace: 'pre-wrap', marginTop: '4px' }}>{reply.fullReply}</div>
                            </details>
                        </div>
                    ))
                ) : (
                    <div>No round selected</div>
                )}
            </div>
        </div>
    )
}

function LiveStreamView({ run }: { run: RunStateView | null }) {
    if (!run) return <div>No live events.</div>
    const events = run.events
        .filter(e => e.type === 'TASK_RESULT')
        .map(e => ({ ...e, ts: e.time }))
        .sort((a, b) => b.time - a.time)

    return (
        <div style={{ maxHeight: '360px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {events.map(ev => (
                <div key={ev.id || ev.time} style={{ background: '#0b1224', padding: '8px', borderRadius: '6px', border: '1px solid #1f2937' }}>
                    <div style={{ fontSize: '12px', color: '#9ca3af' }}>[{new Date(ev.time).toLocaleTimeString()}] Round {run.currentRound} Slot {ev.slot}</div>
                    <div>{(ev as any).payload || 'result received'}</div>
                </div>
            ))}
        </div>
    )
}

function WorkersPanel({
    workers,
    slots,
    onBind,
    onPing,
}: {
    workers: WorkerInfoView[]
    slots: WorkerSlot[]
    onBind: (slot: WorkerSlot, workerId: string | null) => void
    onPing: (workerId: string) => void
}) {
    return (
        <Section title="Workers">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {slots.map(slot => (
                    <div key={slot.slotName} style={{ background: '#0b1224', borderRadius: '6px', padding: '8px', border: '1px solid #1f2937' }}>
                        <div style={{ fontWeight: 600, marginBottom: '4px' }}>{slot.slotName}</div>
                        <select
                            value={slot.boundWorkerId || ''}
                            onInput={e => onBind(slot, (e.target as HTMLSelectElement).value || null)}
                        >
                            <option value="">Unbound</option>
                            {workers.map(w => (
                                <option value={w.workerId} key={w.workerId}>
                                    {w.personaLabel || w.workerId}
                                </option>
                            ))}
                        </select>
                        {slot.boundWorkerId && (
                            <div style={{ fontSize: '12px', marginTop: '4px' }}>
                                Status: {workers.find(w => w.workerId === slot.boundWorkerId)?.status || 'n/a'}
                            </div>
                        )}
                        {slot.boundWorkerId && (
                            <button style={{ marginTop: '6px' }} onClick={() => onPing(slot.boundWorkerId!)}>
                                Ping
                            </button>
                        )}
                    </div>
                ))}
                <div style={{ fontSize: '12px', color: '#9ca3af' }}>Bind workers to roles to enable orchestrated runs.</div>
            </div>
        </Section>
    )
}

function LogsPanel({ events, runId }: { events: ScenarioEvent[]; runId?: string }) {
    const [filter, setFilter] = useState<string>('ALL')
    const filtered = useMemo(() => {
        return events
            .filter(e => (filter === 'ALL' ? true : e.type === filter))
            .sort((a, b) => b.time - a.time)
    }, [events, filter])

    return (
        <Section title="Logs">
            <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                <select value={filter} onInput={e => setFilter((e.target as HTMLSelectElement).value)}>
                    {['ALL', 'TASK_ASSIGNED', 'TASK_RESULT', 'RUN_ERROR', 'RUN_STATUS', 'ARTIFACT_UPDATED'].map(f => (
                        <option key={f} value={f}>{f}</option>
                    ))}
                </select>
                <div style={{ fontSize: '12px', color: '#9ca3af' }}>Run: {runId || 'none'}</div>
            </div>
            <div style={{ maxHeight: '300px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {filtered.map(ev => (
                    <div key={ev.id || ev.time} style={{ background: '#0b1224', padding: '8px', borderRadius: '6px', border: '1px solid #1f2937' }}>
                        <div style={{ fontSize: '12px', color: '#9ca3af' }}>[{new Date(ev.time).toLocaleTimeString()}] {ev.type}</div>
                        <div style={{ fontSize: '12px' }}>
                            {ev.type === 'TASK_ASSIGNED' && `slot=${ev.slot} worker=${ev.workerId}`}
                            {ev.type === 'TASK_RESULT' && `slot=${ev.slot} worker=${ev.workerId} ok=${ev.ok}`}
                            {ev.type === 'RUN_ERROR' && (ev as any).message}
                            {ev.type === 'ARTIFACT_UPDATED' && (ev as any).diffPreview}
                            {ev.type === 'RUN_STATUS' && `${(ev as any).from} -> ${(ev as any).to}`}
                        </div>
                    </div>
                ))}
            </div>
        </Section>
    )
}
