// Claude Service for High Command
// Handles communication with Claude LLM to execute commands via MCP tools

interface ToolInput {
  [key: string]: string | number | boolean
}

interface MCPTool {
  name: string
  description: string
  inputSchema: {
    type: string
    properties: Record<string, unknown>
    required: string[]
  }
}

export class ClaudeService {
  private apiKey: string
  private mcpUrl: string = '/mcp'
  private tools: MCPTool[] = []
  private conversationHistory: Array<{ role: string; content: string }> = []

  constructor() {
    this.apiKey = import.meta.env.VITE_CLAUDE_API_KEY || ''
    if (!this.apiKey) {
      console.log('VITE_CLAUDE_API_KEY not set. Claude may work if backend has CLAUDE_API_KEY in secret.')
    }
  }

  clearConversationHistory(): void {
    this.conversationHistory = []
  }

  getConversationHistory(): Array<{ role: string; content: string }> {
    return this.conversationHistory
  }

  async getAvailableTools(): Promise<MCPTool[]> {
    if (this.tools.length > 0) {
      return this.tools
    }

    try {
      const response = await fetch(`${this.mcpUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Math.random().toString(36).substr(2, 9),
          method: 'tools/list'
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to get tools: ${response.statusText}`)
      }

      const data = await response.json()
      this.tools = data.result?.tools || []
      return this.tools
    } catch (error) {
      console.error('Error fetching tools:', error)
      return []
    }
  }

  private async callMCPTool(toolName: string, toolInput: ToolInput): Promise<string> {
    try {
      const response = await fetch(`${this.mcpUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Math.random().toString(36).substr(2, 9),
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: toolInput
          }
        })
      })

      if (!response.ok) {
        throw new Error(`Tool call failed: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (data.error) {
        throw new Error(`MCP Error: ${data.error.message}`)
      }

      if (data.result?.content?.[0]?.text) {
        return data.result.content[0].text
      }

      return JSON.stringify(data.result)
    } catch (error) {
      console.error('Error calling MCP tool:', error)
      throw error
    }
  }

  async executeCommand(userMessage: string, options?: { useBackendKey?: boolean }): Promise<string> {
    const useBackendKey = options?.useBackendKey ?? false
    if (!this.apiKey && !useBackendKey) {
      throw new Error('Claude API key not configured. Set VITE_CLAUDE_API_KEY or configure CLAUDE_API_KEY in the API.')
    }

    try {
      const tools = await this.getAvailableTools()
      
      if (tools.length === 0) {
        throw new Error('No tools available from MCP server')
      }

      const claudeTools = tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema
      }))

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      }
      if (this.apiKey) {
        headers['x-api-key'] = this.apiKey
      }
      const response = await fetch('/claude/messages', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 1024,
          tools: claudeTools,
          system: `You are a tactical AI assistant for Hell Divers 2 command. Format your responses in clear, readable Markdown for display in a chat interface.

IMPORTANT TABLE FORMATTING RULES:
- ALWAYS use markdown tables with pipes (|) for ANY data with rows and columns
- NEVER use tab-separated text, plain text tables, or other formats
- Table format: | Header1 | Header2 | Header3 |
              | --------- | --------- | --------- |
              | Value1 | Value2 | Value3 |
- Include a separator row with dashes under headers
- Every table must use pipe characters (|) consistently

Example of correct table format:
| Metric | Value | Status |
| --- | --- | --- |
| Active Players | 89,417 | 🟢 Online |
| Missions Won | 717,867,314 | ✅ Success |

Other formatting options:
- **Bold headers with colons** for key information
- Bullet points (- or *) for lists
- Numbered lists (1., 2., 3.) for sequences
- Inline code with backticks for values: \`example\`
- Code blocks with triple backticks for large data blocks

Use clear hierarchy with H2 (##) and H3 (###) headers. Always prioritize markdown tables for structured data.`,
          messages: [
            ...this.conversationHistory,
            {
              role: 'user',
              content: userMessage
            }
          ]
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Claude API error: ${error.error?.message || response.statusText}`)
      }

      const data = await response.json()
      
      let finalResponse = ''
      let toolCalls: Array<{name: string; input: ToolInput}> = []

      for (const block of data.content) {
        if (block.type === 'text') {
          finalResponse += block.text
        } else if (block.type === 'tool_use') {
          toolCalls.push({
            name: block.name,
            input: block.input
          })
        }
      }

      // If tools were called, we need to get the synthesized response from Claude
      if (toolCalls.length > 0) {
        const toolResults: Array<{type: string; tool_use_id: string; content: string}> = []
        
        const toolUseIds: string[] = []
        for (const block of data.content) {
          if (block.type === 'tool_use') {
            toolUseIds.push(block.id)
          }
        }
        
        for (let i = 0; i < toolCalls.length; i++) {
          try {
            const result = await this.callMCPTool(toolCalls[i].name, toolCalls[i].input)
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUseIds[i] || `tool_${i}`,
              content: result
            })
          } catch (error) {
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUseIds[i] || `tool_${i}`,
              content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            })
          }
        }
        
        const followUpResponse = await fetch('/claude/messages', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: 'claude-haiku-4-5',
            max_tokens: 1024,
            tools: claudeTools,
            system: `You are a tactical AI assistant for Hell Divers 2 command. You have received tool results and must now provide a complete, direct answer to the user's question based on those results. Format your responses in Markdown with clear sections, bullet points, and emphasis. Use headers, bold, italics, and code blocks as appropriate.

IMPORTANT: After receiving tool results, ALWAYS provide a complete, direct answer to the user's original question. Do not just acknowledge the tools - synthesize the information into a clear response.`,
            messages: [
              ...this.conversationHistory,
              {
                role: 'user',
                content: userMessage
              },
              {
                role: 'assistant',
                content: data.content
              },
              {
                role: 'user',
                content: toolResults
              }
            ]
          })
        })

        if (!followUpResponse.ok) {
          throw new Error(`Claude follow-up failed: ${followUpResponse.statusText}`)
        }

        const followUpData = await followUpResponse.json()
        
        let finalText = ''
        for (const block of followUpData.content) {
          if (block.type === 'text') {
            finalText += block.text
          }
        }
        
        const responseToReturn = finalText || 'No response from Claude'
        this.conversationHistory.push({
          role: 'user',
          content: userMessage
        })
        this.conversationHistory.push({
          role: 'assistant',
          content: responseToReturn
        })
        
        return responseToReturn
      }

      // No tools were needed, return the text response directly
      const responseToReturn = finalResponse || 'No response from Claude'
      this.conversationHistory.push({
        role: 'user',
        content: userMessage
      })
      this.conversationHistory.push({
        role: 'assistant',
        content: responseToReturn
      })

      return responseToReturn
    } catch (error) {
      console.error('Error executing command with Claude:', error)
      throw error
    }
  }
}
