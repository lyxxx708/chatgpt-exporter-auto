import type { ScenarioRun } from './protocol'

export class ArtifactManager {
    append(run: ScenarioRun, text: string) {
        run.centralArtifact += (run.centralArtifact ? '\n\n' : '') + text
    }

    overwriteSection(run: ScenarioRun, _sectionId: string, newText: string) {
        run.centralArtifact = newText
    }
}
