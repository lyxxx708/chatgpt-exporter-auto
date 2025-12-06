import { useEffect, useMemo, useState } from 'preact/hooks'
import { render } from 'preact'
import { OrchestratorEngine } from './OrchestratorEngine'
import type { ScenarioRun, ScenarioTemplate, WorkerSlot } from './protocol'

interface Props {
    engine: OrchestratorEngine
}

export function mountOrchestratorApp(engine: OrchestratorEngine) {
    const container = document.createElement('div')
    container.id = 'orchestrator-app'
    container.style.position = 'fixed'
    container.style.top = '20px'
    container.style.right = '20px'
    container.style.width = '440px'
    container.style.height = 'calc(100vh - 40px)'
    container.style.overflow = 'auto'
    container.style.zIndex = '10001'
    container.style.background = '#0f172a'
    container.style.color = '#e2e8f0'
    container.style.padding = '12px'
    container.style.borderRadius = '12px'
    container.style.boxShadow = '0 10px 30px rgba(0,0,0,0.45)'
    document.body.appendChild(container)
    render(<OrchestratorUI engine={engine} />, container)
    return container
}

function OrchestratorUI({ engine }: Props) {
    const [snapshot, setSnapshot] = useState(engine.getSnapshot())
    const [selectedTemplate, setSelectedTemplate] = useState<string>(engine.getSnapshot().templates[0]?.id)
    const [initialArtifact, setInitialArtifact] = useState('')
    const [activeRun, setActiveRun] = useState<ScenarioRun | undefined>(engine.getActiveRun())

    useEffect(() => {
        const unsub = engine.subscribe(() => {
            setSnapshot(engine.getSnapshot())
            setActiveRun(engine.getActiveRun())
        })
        const unsubRun = engine.onRunUpdated(run => setActiveRun(run))
        return () => {
            unsub()
            unsubRun()
        }
    }, [engine])

    const selectedTemplateObj = useMemo(() => snapshot.templates.find(t => t.id === selectedTemplate), [snapshot.templates, selectedTemplate])

    useEffect(() => {
        if (selectedTemplateObj) {
            engine.syncSlotsFromTemplate(selectedTemplateObj)
            setSnapshot(engine.getSnapshot())
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTemplateObj?.id])

    const workerOptions = snapshot.workers
    const slots = snapshot.slots

    const bindSlot = (slot: WorkerSlot, workerId?: string) => {
        engine.setBoundWorker(slot.slotName, workerId)
        setSnapshot(engine.getSnapshot())
    }

    const startRun = () => {
        if (selectedTemplate) {
            engine.startRun(selectedTemplate, initialArtifact)
            setActiveRun(engine.getActiveRun())
        }
    }

    const exportArtifact = () => {
        if (!activeRun) return
        const blob = new Blob([activeRun.centralArtifact], { type: 'text/markdown' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${activeRun.runId}.md`
        a.click()
        URL.revokeObjectURL(url)
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}>
            <h2 style={{ margin: 0, fontSize: '18px' }}>Orchestrator</h2>
            <WorkersDashboard slots={slots} workers={workerOptions} onBind={bindSlot} />
            <ScenarioSelector
                templates={snapshot.templates}
                selected={selectedTemplate}
                onSelect={setSelectedTemplate}
                onSave={tpl => engine.addOrUpdateTemplate(tpl)}
            />
            <RunControls
                template={selectedTemplateObj}
                run={activeRun}
                onStart={startRun}
                onPause={() => engine.pauseRun()}
                onStop={() => engine.stopRun()}
                onInitialArtifactChange={setInitialArtifact}
                initialArtifact={initialArtifact}
            />
            <ArtifactView run={activeRun} onExport={exportArtifact} />
            <EventLog run={activeRun} />
        </div>
    )
}

function WorkersDashboard({
    slots,
    workers,
    onBind,
}: {
    slots: WorkerSlot[]
    workers: { workerId: string; personaLabel: string; status: string; queueLength: number }[]
    onBind: (slot: WorkerSlot, workerId?: string) => void
}) {
    return (
        <div>
            <div style={{ fontWeight: 700, marginBottom: '4px' }}>Workers Dashboard</div>
            <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                <thead>
                    <tr>
                        <th align="left">Slot</th>
                        <th align="left">Worker</th>
                        <th align="left">Status</th>
                        <th align="left">Queue</th>
                    </tr>
                </thead>
                <tbody>
                    {slots.map(slot => (
                        <tr key={slot.slotName}>
                            <td>{slot.slotName}</td>
                            <td>
                                <select
                                    value={slot.boundWorkerId || ''}
                                    onInput={e => onBind(slot, (e.target as HTMLSelectElement).value || undefined)}
                                    style={{ width: '100%' }}
                                >
                                    <option value="">Unbound</option>
                                    {workers.map(w => (
                                        <option value={w.workerId} key={w.workerId}>
                                            {w.personaLabel || w.workerId}
                                        </option>
                                    ))}
                                </select>
                            </td>
                            <td>{slot.boundWorkerId ? workers.find(w => w.workerId === slot.boundWorkerId)?.status || 'n/a' : '-'}</td>
                            <td>{slot.boundWorkerId ? workers.find(w => w.workerId === slot.boundWorkerId)?.queueLength ?? '-' : '-'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

function ScenarioSelector({
    templates,
    selected,
    onSelect,
    onSave,
}: {
    templates: ScenarioTemplate[]
    selected?: string
    onSelect: (id: string) => void
    onSave: (tpl: ScenarioTemplate) => void
}) {
    const [editing, setEditing] = useState<ScenarioTemplate | null>(null)

    useEffect(() => {
        const tpl = templates.find(t => t.id === selected)
        if (tpl) setEditing(tpl)
    }, [selected, templates])

    const updateField = (key: keyof ScenarioTemplate, value: any) => {
        if (!editing) return
        setEditing({ ...editing, [key]: value })
    }

    const save = () => {
        if (editing) onSave(editing)
    }

    return (
        <div style={{ borderTop: '1px solid #1f2937', paddingTop: '6px' }}>
            <div style={{ fontWeight: 700, marginBottom: '4px' }}>Scenario Templates</div>
            <select value={selected} onInput={e => onSelect((e.target as HTMLSelectElement).value)} style={{ width: '100%' }}>
                {templates.map(t => (
                    <option key={t.id} value={t.id}>
                        {t.name}
                    </option>
                ))}
            </select>
            {editing && (
                <div style={{ marginTop: '6px' }}>
                    <input
                        style={{ width: '100%', marginBottom: '4px' }}
                        value={editing.name}
                        onInput={e => updateField('name', (e.target as HTMLInputElement).value)}
                    />
                    <textarea
                        style={{ width: '100%', minHeight: '60px' }}
                        value={editing.description || ''}
                        onInput={e => updateField('description', (e.target as HTMLTextAreaElement).value)}
                    />
                    <div style={{ fontSize: '12px', marginTop: '4px' }}>
                        Roles: {editing.roles.map(r => r.slotName).join(', ')}
                    </div>
                    <div style={{ fontSize: '12px', marginTop: '4px' }}>Stages: {editing.stages.length}</div>
                    <button style={{ marginTop: '4px' }} onClick={save}>
                        Save template
                    </button>
                </div>
            )}
        </div>
    )
}

function RunControls({
    template,
    run,
    onStart,
    onPause,
    onStop,
    initialArtifact,
    onInitialArtifactChange,
}: {
    template?: ScenarioTemplate
    run?: ScenarioRun
    onStart: () => void
    onPause: () => void
    onStop: () => void
    initialArtifact: string
    onInitialArtifactChange: (value: string) => void
}) {
    return (
        <div style={{ borderTop: '1px solid #1f2937', paddingTop: '6px' }}>
            <div style={{ fontWeight: 700, marginBottom: '4px' }}>Run Control</div>
            <textarea
                style={{ width: '100%', minHeight: '60px' }}
                placeholder="Initial artifact (optional)"
                value={initialArtifact}
                onInput={e => onInitialArtifactChange((e.target as HTMLTextAreaElement).value)}
            />
            <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                <button onClick={onStart} disabled={!template}>
                    Start
                </button>
                <button onClick={onPause} disabled={!run}>
                    Pause
                </button>
                <button onClick={onStop} disabled={!run}>
                    Stop
                </button>
            </div>
            {run && (
                <div style={{ fontSize: '12px', marginTop: '6px' }}>
                    <div>Status: {run.status}</div>
                    <div>Round: {run.currentRound}</div>
                    <div>Stage: {run.currentStagePath.join(' / ')}</div>
                </div>
            )}
        </div>
    )
}

function ArtifactView({ run, onExport }: { run?: ScenarioRun; onExport: () => void }) {
    return (
        <div style={{ borderTop: '1px solid #1f2937', paddingTop: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 700 }}>Artifact</div>
                <button onClick={onExport} disabled={!run}>
                    Export
                </button>
            </div>
            <div
                style={{
                    background: '#111827',
                    padding: '8px',
                    minHeight: '120px',
                    whiteSpace: 'pre-wrap',
                    fontSize: '12px',
                    borderRadius: '8px',
                    marginTop: '4px',
                }}
            >
                {run?.centralArtifact || 'No artifact yet'}
            </div>
        </div>
    )
}

function EventLog({ run }: { run?: ScenarioRun }) {
    if (!run) return null
    const items = [...run.events].reverse().slice(0, 30)
    return (
        <div style={{ borderTop: '1px solid #1f2937', paddingTop: '6px' }}>
            <div style={{ fontWeight: 700 }}>Events</div>
            <div style={{ fontSize: '12px', maxHeight: '180px', overflow: 'auto' }}>
                {items.map((e, idx) => (
                    <div key={idx} style={{ marginBottom: '4px' }}>
                        <code>{e.type}</code> - {new Date(e.time).toLocaleTimeString()}
                    </div>
                ))}
            </div>
        </div>
    )
}
