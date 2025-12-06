import { useEffect, useMemo, useState } from 'preact/hooks'
import { render } from 'preact'
import { ChatgptUiWorker } from './ChatgptUiWorker'
import type { EventMessage, WorkerConfig, WorkerStatus } from './protocol'

interface PanelProps {
    worker: ChatgptUiWorker
}

interface PanelState {
    workerId: string
    personaLabel: string
    status: WorkerStatus
    queueLength: number
    config: WorkerConfig
    reloadCount: number
}

const statusColor: Record<WorkerStatus, string> = {
    idle: '#10a37f',
    busy: '#f59e0b',
    cooldown: '#6366f1',
    error: '#ef4444',
}

function WorkerPanel({ worker }: PanelProps) {
    const [state, setState] = useState<PanelState>(() => worker.getState())
    const [text, setText] = useState('')

    useEffect(() => {
        const syncState = () => setState(worker.getState())
        const unsubscribe = worker.onEvent((event: EventMessage) => {
            if (event.type === 'HELLO' || event.type === 'STATUS') {
                syncState()
            }
        })
        return unsubscribe
    }, [worker])

    const config = state.config

    const statusBadgeStyle = useMemo(() => ({
        background: statusColor[state.status],
        color: '#0b0f13',
        padding: '2px 8px',
        borderRadius: '6px',
        fontSize: '12px',
        fontWeight: 600,
        textTransform: 'uppercase',
    }), [state.status])

    const containerStyle: Partial<CSSStyleDeclaration> = {
        position: 'fixed',
        bottom: '20px',
        left: '20px',
        width: '320px',
        background: '#111827',
        color: '#e5e7eb',
        padding: '12px',
        borderRadius: '10px',
        boxShadow: '0 10px 35px rgba(0,0,0,0.4)',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        fontSize: '13px',
        zIndex: '10000',
    }

    const inputStyle: Partial<CSSStyleDeclaration> = {
        width: '100%',
        padding: '6px 8px',
        borderRadius: '6px',
        border: '1px solid #374151',
        background: '#0b1221',
        color: '#e5e7eb',
        marginTop: '4px',
    }

    const labelStyle: Partial<CSSStyleDeclaration> = {
        display: 'block',
        marginTop: '8px',
        fontWeight: 600,
    }

    const buttonStyle: Partial<CSSStyleDeclaration> = {
        padding: '8px 10px',
        borderRadius: '6px',
        border: 'none',
        cursor: 'pointer',
        fontWeight: 600,
    }

    const smallButtonStyle: Partial<CSSStyleDeclaration> = {
        ...buttonStyle,
        padding: '6px 8px',
        fontSize: '12px',
    }

    const updateConfig = (partial: Partial<WorkerConfig>) => {
        worker.updateConfig(partial)
        setState(prev => ({ ...prev, config: { ...prev.config, ...partial } }))
    }

    const enqueueTask = () => {
        if (!text.trim()) return
        const id = `task_${Math.random().toString(36).slice(2, 8)}`
        worker.enqueue({ id, prompt: text, metadata: {} })
        setText('')
    }

    const onPersonaChange = (value: string) => {
        setState(prev => ({ ...prev, personaLabel: value }))
        worker.setPersonaLabel(value)
    }

    return (
        <div style={containerStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <div style={{ fontWeight: 700 }}>Worker Control</div>
                <div style={statusBadgeStyle}>{state.status}</div>
            </div>
            <div style={{ marginBottom: '4px', fontSize: '12px', color: '#9ca3af' }}>Worker: {state.workerId}</div>
            <div style={{ marginBottom: '8px', fontSize: '12px', color: '#9ca3af' }}>Reloads: {state.reloadCount}</div>

            <label style={labelStyle}>
                Persona label
                <input
                    style={inputStyle}
                    value={state.personaLabel}
                    onInput={e => onPersonaChange((e.target as HTMLInputElement).value)}
                    placeholder="Label for this tab"
                />
            </label>

            <div style={{ marginTop: '12px', fontWeight: 700 }}>Queue</div>
            <div style={{ fontSize: '12px', color: '#9ca3af' }}>Length: {state.queueLength}</div>

            <label style={labelStyle}>
                Min delay (ms)
                <input
                    style={inputStyle}
                    type="number"
                    min={0}
                    value={config.minDelayMs}
                    onInput={e => updateConfig({ minDelayMs: Number((e.target as HTMLInputElement).value) })}
                />
            </label>
            <label style={labelStyle}>
                Max delay (ms)
                <input
                    style={inputStyle}
                    type="number"
                    min={0}
                    value={config.maxDelayMs}
                    onInput={e => updateConfig({ maxDelayMs: Number((e.target as HTMLInputElement).value) })}
                />
            </label>
            <label style={labelStyle}>
                Max retries
                <input
                    style={inputStyle}
                    type="number"
                    min={0}
                    value={config.maxRetries}
                    onInput={e => updateConfig({ maxRetries: Number((e.target as HTMLInputElement).value) })}
                />
            </label>

            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                        type="checkbox"
                        checked={config.autoProcess}
                        onInput={e => updateConfig({ autoProcess: (e.target as HTMLInputElement).checked })}
                    />
                    <span>Auto process queue</span>
                </label>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                        type="checkbox"
                        checked={config.autoReloadOnError}
                        onInput={e => updateConfig({ autoReloadOnError: (e.target as HTMLInputElement).checked })}
                    />
                    <span>Auto reload on error</span>
                </label>
            </div>

            <label style={labelStyle}>
                Reload cooldown (s)
                <input
                    style={inputStyle}
                    type="number"
                    min={0}
                    value={Math.floor(config.reloadCooldownMs / 1000)}
                    onInput={e =>
                        updateConfig({ reloadCooldownMs: Number((e.target as HTMLInputElement).value) * 1000 })
                    }
                />
            </label>

            <div style={{ marginTop: '12px', fontWeight: 700 }}>Manual control</div>
            <textarea
                style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                value={text}
                onInput={e => setText((e.target as HTMLTextAreaElement).value)}
                placeholder="Enter a prompt to enqueue"
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button style={{ ...buttonStyle, background: '#10a37f', color: '#0b0f13' }} onClick={enqueueTask}>
                    Enqueue
                </button>
                <button style={{ ...smallButtonStyle, background: '#1f2937', color: '#e5e7eb' }} onClick={() => worker.processOnce()}>
                    Process once
                </button>
            </div>
        </div>
    )
}

export function renderWorkerPanel(worker: ChatgptUiWorker) {
    const container = document.createElement('div')
    container.id = 'chatgpt-ui-worker-panel'
    document.body.appendChild(container)
    render(<WorkerPanel worker={worker} />, container)
}
