import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

import { registerPlaybookResources } from '@/resources/playbooks'
import { AgentResolveResourceSchema } from '@/schema/tool-inputs'
import { PLAYBOOK_IDS, PLAYBOOK_URI_PREFIX, playbookUri } from '@/tools/agentPlatform/playbookIds'
import { PLAYBOOKS } from '@/tools/agentPlatform/playbooks'
import { buildToolSurface, PLAYBOOK_TOOLS } from '@/tools/agentPlatform/playbookTools'
import { resolveResourceHandler } from '@/tools/agentPlatform/resolveResource'
import { getToolDefinitions } from '@/tools/toolDefinitions'
import type { Context } from '@/tools/types'

// Canonical source: docs/agent-platform/playbooks/. The build copies these into
// shared/playbooks/ (embedded) — both must stay in lockstep with PLAYBOOK_IDS.
const DOCS_PLAYBOOKS_DIR = resolve(__dirname, '../../../../docs/agent-platform/playbooks')

// Context whose api key carries the given scopes (drives the live tool surface).
const ctxWithScopes = (scopes: string[]): Context =>
    ({ stateManager: { getApiKey: async () => ({ scopes }) } }) as unknown as Context
// No stateManager → getApiKey throws → handler renders the flat (scope-unknown) surface.
const ctx = {} as Context

describe('agent-resolve-resource', () => {
    describe('AgentResolveResourceSchema', () => {
        it('accepts a bare playbook id', () => {
            expect(AgentResolveResourceSchema.safeParse({ resource: 'editing-agents-safely' }).success).toBe(true)
        })

        it('accepts a full resource URI', () => {
            const uri = `${PLAYBOOK_URI_PREFIX}editing-agents-safely`
            expect(AgentResolveResourceSchema.safeParse({ resource: uri }).success).toBe(true)
        })

        it('rejects a missing / non-string resource', () => {
            expect(AgentResolveResourceSchema.safeParse({}).success).toBe(false)
            expect(AgentResolveResourceSchema.safeParse({ resource: 5 }).success).toBe(false)
        })
    })

    describe('resolveResourceHandler', () => {
        it('returns id, uri, title and markdown content for a bare id', async () => {
            const result = await resolveResourceHandler(ctx, { resource: 'debugging-sessions' })
            expect(result.id).toBe('debugging-sessions')
            expect(result.uri).toBe(`${PLAYBOOK_URI_PREFIX}debugging-sessions`)
            expect(result.title.length).toBeGreaterThan(0)
            expect(result.content.length).toBeGreaterThan(100)
        })

        it('resolves the same playbook whether passed an id or its URI', async () => {
            const byId = await resolveResourceHandler(ctx, { resource: 'reading-an-agent' })
            const byUri = await resolveResourceHandler(ctx, { resource: playbookUri('reading-an-agent') })
            expect(byUri).toEqual(byId)
        })

        it('throws a helpful error on an unknown reference', async () => {
            await expect(resolveResourceHandler(ctx, { resource: 'does-not-exist' })).rejects.toThrow(
                /Unknown playbook/
            )
        })
    })

    describe('playbook inventory', () => {
        it('PLAYBOOK_IDS matches the markdown files in the canonical docs dir', () => {
            const docFiles = readdirSync(DOCS_PLAYBOOKS_DIR)
                .filter((f) => f.endsWith('.md'))
                .map((f) => f.replace(/\.md$/, ''))
                .sort()
            expect(docFiles).toEqual([...PLAYBOOK_IDS].sort())
        })

        it('every id has embedded, non-empty content', () => {
            for (const id of PLAYBOOK_IDS) {
                expect(PLAYBOOKS[id]?.content.length, id).toBeGreaterThan(100)
            }
        })
    })

    describe('live tool surface', () => {
        it('every tool named in PLAYBOOK_TOOLS resolves to a real tool definition', () => {
            const defs = getToolDefinitions()
            for (const [id, names] of Object.entries(PLAYBOOK_TOOLS)) {
                for (const name of names) {
                    expect(defs[name], `${id} → ${name}`).not.toBeUndefined()
                }
            }
        })

        it('classifies the no-source creator as gated without agents:write, callable with it', () => {
            const readOnly = buildToolSurface('authoring-new-agents', ['agents:read'])
            const create = readOnly.find((t) => t.name === 'agent-applications-revisions-create')!
            expect(create.missingScopes).toEqual(['agents:write'])

            const writer = buildToolSurface('authoring-new-agents', ['agents:write'])
            expect(writer.find((t) => t.name === 'agent-applications-revisions-create')!.missingScopes).toEqual([])

            // all-access wildcard satisfies everything
            const star = buildToolSurface('authoring-new-agents', ['*'])
            expect(star.every((t) => t.missingScopes.length === 0)).toBe(true)
        })

        it('appends a scope-aware surface to the returned content', async () => {
            const result = await resolveResourceHandler(ctxWithScopes(['agents:read']), {
                resource: 'authoring-new-agents',
            })
            expect(result.content).toContain('## Tools for this playbook (live)')
            // The creator agents keep "not finding" is named, and shown as scope-gated.
            expect(result.content).toMatch(/agent-applications-revisions-create.*needs: agents:write/)
            expect(result.tools.gated).toContain('agent-applications-revisions-create')
            expect(result.tools.gated).toContain('agent-applications-create') // create needs agents:write
            // a read-scoped tool stays callable under agents:read
            expect(result.tools.callable).toContain('agent-native-tools-list')
        })

        it('with agents:write the creator moves into the callable set', async () => {
            const result = await resolveResourceHandler(ctxWithScopes(['agents:write']), {
                resource: 'authoring-new-agents',
            })
            expect(result.tools.callable).toContain('agent-applications-revisions-create')
            expect(result.tools.gated).not.toContain('agent-applications-revisions-create')
        })

        it('playbooks with no associated tools omit the surface section', async () => {
            const result = await resolveResourceHandler(ctxWithScopes(['*']), { resource: 'safety-and-boundaries' })
            expect(result.content).not.toContain('Tools for this playbook')
            expect(result.tools.callable).toHaveLength(0)
            expect(result.tools.gated).toHaveLength(0)
        })
    })

    describe('registerPlaybookResources', () => {
        it('registers each playbook as a first-class resource at its fixed URI', async () => {
            const calls: Array<{ name: string; uri: string; read: (u: URL) => Promise<unknown> }> = []
            const server = {
                registerResource: vi.fn(
                    (name: string, uri: string, _meta: unknown, read: (u: URL) => Promise<unknown>) => {
                        calls.push({ name, uri, read })
                    }
                ),
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            registerPlaybookResources(server as any)

            expect(calls).toHaveLength(PLAYBOOK_IDS.length)
            const uris = calls.map((c) => c.uri).sort()
            expect(uris).toEqual(PLAYBOOK_IDS.map(playbookUri).sort())

            // Each read callback returns the playbook's markdown at its own URI.
            const sample = calls.find((c) => c.uri === playbookUri('safety-and-boundaries'))!
            const read = (await sample.read({ toString: () => sample.uri } as URL)) as {
                contents: Array<{ uri: string; mimeType: string; text: string }>
            }
            expect(read.contents[0]!.mimeType).toBe('text/markdown')
            expect(read.contents[0]!.uri).toBe(sample.uri)
            expect(read.contents[0]!.text).toBe(PLAYBOOKS['safety-and-boundaries'].content)
        })
    })
})
