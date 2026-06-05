import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import { playbookUri } from '@/tools/agentPlatform/playbookIds'
import { PLAYBOOKS } from '@/tools/agentPlatform/playbooks'

const PLAYBOOK_MIME_TYPE = 'text/markdown'

/**
 * Register every operator playbook as a first-class MCP resource at its fixed
 * URI (`PLAYBOOK_URI_PREFIX` + id). Clients that support resources can list and
 * read them directly; the `agent-resolve-resource` tool is the fallback for
 * clients that only do tools, and accepts the same URIs.
 */
export function registerPlaybookResources(server: McpServer): void {
    for (const playbook of Object.values(PLAYBOOKS)) {
        server.registerResource(
            `playbook-${playbook.id}`,
            playbookUri(playbook.id),
            {
                mimeType: PLAYBOOK_MIME_TYPE,
                description: playbook.title,
            },
            async (uri) => ({
                contents: [
                    {
                        uri: uri.toString(),
                        mimeType: PLAYBOOK_MIME_TYPE,
                        text: playbook.content,
                    },
                ],
            })
        )
    }
}
