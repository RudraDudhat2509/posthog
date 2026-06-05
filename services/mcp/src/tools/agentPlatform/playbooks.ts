// Embedded operator playbooks. The `.md` bodies are copied into shared/playbooks
// at build time by scripts/copy-instructions.ts (canonical source:
// docs/agent-platform/playbooks/) and bundled via the wrangler `**/*.md` Text rule.
import authoringNewAgents from '@shared/playbooks/authoring-new-agents.md'
import costAndQuotaAnalysis from '@shared/playbooks/cost-and-quota-analysis.md'
import debuggingSessions from '@shared/playbooks/debugging-sessions.md'
import designingMcpSurfaces from '@shared/playbooks/designing-mcp-surfaces.md'
import editingAgentsSafely from '@shared/playbooks/editing-agents-safely.md'
import platformMentalModel from '@shared/playbooks/platform-mental-model.md'
import readingAnAgent from '@shared/playbooks/reading-an-agent.md'
import runningAndEvaluatingTests from '@shared/playbooks/running-and-evaluating-tests.md'
import safetyAndBoundaries from '@shared/playbooks/safety-and-boundaries.md'
import secretsAndIntegrations from '@shared/playbooks/secrets-and-integrations.md'
import usingTheConsoleUi from '@shared/playbooks/using-the-console-ui.md'
import usingTheRegistry from '@shared/playbooks/using-the-registry.md'
import workingOutsideTheConsole from '@shared/playbooks/working-outside-the-console.md'

import { type PlaybookId, PLAYBOOK_IDS, PLAYBOOK_TITLES } from './playbookIds'

export interface Playbook {
    id: PlaybookId
    title: string
    content: string
}

const PLAYBOOK_CONTENT: Record<PlaybookId, string> = {
    'platform-mental-model': platformMentalModel,
    'reading-an-agent': readingAnAgent,
    'debugging-sessions': debuggingSessions,
    'editing-agents-safely': editingAgentsSafely,
    'authoring-new-agents': authoringNewAgents,
    'secrets-and-integrations': secretsAndIntegrations,
    'designing-mcp-surfaces': designingMcpSurfaces,
    'running-and-evaluating-tests': runningAndEvaluatingTests,
    'using-the-console-ui': usingTheConsoleUi,
    'working-outside-the-console': workingOutsideTheConsole,
    'cost-and-quota-analysis': costAndQuotaAnalysis,
    'safety-and-boundaries': safetyAndBoundaries,
    'using-the-registry': usingTheRegistry,
}

export const PLAYBOOKS: Record<PlaybookId, Playbook> = Object.fromEntries(
    PLAYBOOK_IDS.map((id) => [id, { id, title: PLAYBOOK_TITLES[id], content: PLAYBOOK_CONTENT[id] }])
) as Record<PlaybookId, Playbook>
