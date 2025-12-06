import { ChatgptUiWorker } from '../worker/ChatgptUiWorker'
import { OrchestratorEngine } from './OrchestratorEngine'
import { mountOrchestratorApp } from './OrchestratorApp'

export function enableCoordinatorMode(worker: ChatgptUiWorker) {
    let engine: OrchestratorEngine | null = null
    let container: HTMLElement | null = null

    const maybeMount = (label: string) => {
        const isCoordinator = label.trim().toLowerCase() === 'coordinator'
        if (isCoordinator && !engine) {
            engine = new OrchestratorEngine()
            container = mountOrchestratorApp(engine)
        }
        if (!isCoordinator && engine) {
            engine.dispose()
            engine = null
            container?.remove()
            container = null
        }
    }

    maybeMount(worker.getState().personaLabel)

    worker.onEvent(event => {
        if (event.type === 'HELLO') {
            maybeMount(event.personaLabel)
        }
    })
}
