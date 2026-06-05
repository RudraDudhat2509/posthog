// Operator playbook ids — the canonical list, kept in lockstep with the markdown
// in docs/agent-platform/playbooks/ (a vitest drift guard asserts they match).
// Pure constants only (no `.md` imports) so this module is safe to load from the
// tsx schema-generation script via src/schema/tool-inputs.ts.
export const PLAYBOOK_IDS = [
    'platform-mental-model',
    'reading-an-agent',
    'debugging-sessions',
    'editing-agents-safely',
    'authoring-new-agents',
    'secrets-and-integrations',
    'designing-mcp-surfaces',
    'running-and-evaluating-tests',
    'using-the-console-ui',
    'working-outside-the-console',
    'cost-and-quota-analysis',
    'safety-and-boundaries',
    'using-the-registry',
] as const

export type PlaybookId = (typeof PLAYBOOK_IDS)[number]

// Fixed URI scheme, declared once. Each playbook is also a first-class MCP
// resource at `<PLAYBOOK_URI_PREFIX><id>`; everything else (the resolver tool,
// the resource registration, the schema describe) derives from this constant.
// The resolver accepts either a bare id or the full URI.
export const PLAYBOOK_URI_PREFIX = 'posthog://agent-platform/playbooks/'

export const playbookUri = (id: PlaybookId): string => `${PLAYBOOK_URI_PREFIX}${id}`

export const PLAYBOOK_URIS: readonly string[] = PLAYBOOK_IDS.map(playbookUri)

/**
 * Normalize a caller-supplied reference (bare id or full `<PLAYBOOK_URI_PREFIX><id>`
 * URI) to a known PlaybookId, or `undefined` if it matches no playbook.
 */
export function playbookIdFromRef(ref: string): PlaybookId | undefined {
    const candidate = ref.startsWith(PLAYBOOK_URI_PREFIX) ? ref.slice(PLAYBOOK_URI_PREFIX.length) : ref
    return (PLAYBOOK_IDS as readonly string[]).includes(candidate) ? (candidate as PlaybookId) : undefined
}

export const PLAYBOOK_TITLES: Record<PlaybookId, string> = {
    'platform-mental-model': 'Platform mental model — agents, specs, bundles, revisions',
    'reading-an-agent': 'Reading an agent — inspect and summarize',
    'debugging-sessions': 'Debugging sessions — triage failures and read logs',
    'editing-agents-safely': 'Editing agents safely — branch, validate, freeze, promote',
    'authoring-new-agents': 'Authoring new agents from scratch',
    'secrets-and-integrations': 'Secrets and integrations — wiring credentials safely',
    'designing-mcp-surfaces': "Designing an agent's MCP tool surface",
    'running-and-evaluating-tests': 'Running and evaluating agent tests',
    'using-the-console-ui': 'Using the agent console UI',
    'working-outside-the-console': 'Working outside the console (MCP / IDE / Slack)',
    'cost-and-quota-analysis': 'Cost and quota analysis via PostHog analytics',
    'safety-and-boundaries': 'Safety and boundaries — hard rules',
    'using-the-registry': 'Using the Tools & Skills registry',
}
