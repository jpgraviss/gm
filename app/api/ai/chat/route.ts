import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatRequest {
  messages: ChatMessage[]
  conversationId?: string
}

// ─── Tool definitions for Claude ────────────────────────────────────────────

const TOOLS = [
  {
    name: 'search_companies',
    description: 'Search CRM companies by name, industry, status, or owner. Returns matching companies with key details.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search term to match against company name, industry, or description' },
        status: { type: 'string', description: 'Filter by status: Prospect, Active Client, Past Client, Partner, Churned' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_contacts',
    description: 'Search CRM contacts by name, email, company, or title.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search term to match against contact name, email, or company' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_deals',
    description: 'Search deals by company name, stage, or service type. Returns deal details including value and stage.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search term to match against company or service type' },
        stage: { type: 'string', description: 'Filter by stage: Lead, Qualified, Proposal Sent, Contract Sent, Closed Won, Closed Lost' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_contracts',
    description: 'Search contracts by company name, status, or service type.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search term to match against company or service type' },
        status: { type: 'string', description: 'Filter by status: Draft, Sent, Viewed, Signed by Client, Fully Executed, Expired' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_proposals',
    description: 'Search proposals by company name, status, or service type.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search term to match against company or service type' },
        status: { type: 'string', description: 'Filter by status: Draft, Pending Approval, Approved, Sent, Viewed, Accepted, Declined' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_projects',
    description: 'Search projects by company name, status, or service type.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search term to match against company or service type' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_invoices',
    description: 'Search invoices by company name, status, or amount.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search term to match against company' },
        status: { type: 'string', description: 'Filter by status: Pending, Sent, Overdue, Paid' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_tickets',
    description: 'Search support tickets by subject, company, or status.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search term to match against subject or company' },
        status: { type: 'string', description: 'Filter by status: Open, In Progress, Resolved, Closed' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_dashboard_summary',
    description: 'Get a high-level dashboard summary: total deals, revenue, pipeline value, overdue invoices, active projects, upcoming renewals.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'generate_document',
    description: 'Generate a filled-in document (proposal, service agreement/contract, or addendum) from a template. Provide the document type and the data to populate placeholders.',
    input_schema: {
      type: 'object' as const,
      properties: {
        document_type: {
          type: 'string',
          enum: ['proposal', 'contract', 'addendum'],
          description: 'Type of document to generate',
        },
        client_name: { type: 'string', description: 'Client/company name' },
        data: {
          type: 'object',
          description: 'Key-value pairs to fill template placeholders. Keys should match template placeholders like CLIENT NAME, DATE, SERVICE 1, PRICE, etc.',
          additionalProperties: { type: 'string' },
        },
      },
      required: ['document_type', 'client_name'],
    },
  },
  {
    name: 'write_proposal',
    description: 'Write a custom AI-generated proposal for a client. Provide the company name, services needed, pricing, and any additional context. The AI will craft professional proposal content tailored to the client.',
    input_schema: {
      type: 'object' as const,
      properties: {
        company_name: { type: 'string', description: 'Client company name' },
        services: { type: 'string', description: 'Comma-separated list of services (e.g. "Website Design, SEO, Social Media")' },
        budget: { type: 'string', description: 'Budget or pricing details' },
        timeline: { type: 'string', description: 'Project timeline' },
        context: { type: 'string', description: 'Additional context about the client, their industry, goals, or specific requirements' },
      },
      required: ['company_name', 'services'],
    },
  },
  {
    name: 'list_templates',
    description: 'List all available document templates (proposals, contracts, addendums).',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
]

// ─── Tool execution ─────────────────────────────────────────────────────────

async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  const db = createServiceClient()

  switch (name) {
    case 'search_companies': {
      const q = (input.query as string).toLowerCase()
      const { data } = await db.from('crm_companies').select('id, name, industry, status, owner, website, hq, size, total_deal_value, tags').order('name')
      const filtered = (data ?? []).filter(c =>
        c.name?.toLowerCase().includes(q) ||
        c.industry?.toLowerCase().includes(q) ||
        c.owner?.toLowerCase().includes(q) ||
        (input.status && c.status === input.status)
      )
      if (filtered.length === 0) return 'No companies found matching that search.'
      return JSON.stringify(filtered.slice(0, 20))
    }

    case 'search_contacts': {
      const q = (input.query as string).toLowerCase()
      const { data } = await db.from('crm_contacts').select('id, full_name, company_name, title, emails, phones, is_primary, owner, tags, lifecycle_stage').order('full_name')
      const filtered = (data ?? []).filter(c =>
        c.full_name?.toLowerCase().includes(q) ||
        c.company_name?.toLowerCase().includes(q) ||
        c.emails?.some((e: string) => e.toLowerCase().includes(q)) ||
        c.title?.toLowerCase().includes(q)
      )
      if (filtered.length === 0) return 'No contacts found matching that search.'
      return JSON.stringify(filtered.slice(0, 20))
    }

    case 'search_deals': {
      const q = (input.query as string).toLowerCase()
      const { data } = await db.from('deals').select('id, company, stage, value, service_type, close_date, assigned_rep, probability, last_activity').order('created_at', { ascending: false })
      const filtered = (data ?? []).filter(d =>
        d.company?.toLowerCase().includes(q) ||
        d.service_type?.toLowerCase().includes(q) ||
        (input.stage && d.stage === input.stage)
      )
      if (filtered.length === 0) return 'No deals found matching that search.'
      return JSON.stringify(filtered.slice(0, 20))
    }

    case 'search_contracts': {
      const q = (input.query as string).toLowerCase()
      const { data } = await db.from('contracts').select('id, company, status, value, billing_structure, start_date, duration, renewal_date, assigned_rep, service_type').order('created_at', { ascending: false })
      const filtered = (data ?? []).filter(c =>
        c.company?.toLowerCase().includes(q) ||
        c.service_type?.toLowerCase().includes(q) ||
        (input.status && c.status === input.status)
      )
      if (filtered.length === 0) return 'No contracts found matching that search.'
      return JSON.stringify(filtered.slice(0, 20))
    }

    case 'search_proposals': {
      const q = (input.query as string).toLowerCase()
      const { data } = await db.from('proposals').select('id, company, status, value, service_type, assigned_rep, created_date, sent_date').order('created_at', { ascending: false })
      const filtered = (data ?? []).filter(p =>
        p.company?.toLowerCase().includes(q) ||
        p.service_type?.toLowerCase().includes(q) ||
        (input.status && p.status === input.status)
      )
      if (filtered.length === 0) return 'No proposals found matching that search.'
      return JSON.stringify(filtered.slice(0, 20))
    }

    case 'search_projects': {
      const q = (input.query as string).toLowerCase()
      const { data } = await db.from('projects').select('id, company, service_type, status, start_date, launch_date, assigned_team, progress').order('created_at', { ascending: false })
      const filtered = (data ?? []).filter(p =>
        p.company?.toLowerCase().includes(q) ||
        p.service_type?.toLowerCase().includes(q) ||
        p.status?.toLowerCase().includes(q)
      )
      if (filtered.length === 0) return 'No projects found matching that search.'
      return JSON.stringify(filtered.slice(0, 20))
    }

    case 'search_invoices': {
      const q = (input.query as string).toLowerCase()
      const { data } = await db.from('invoices').select('id, company, amount, status, due_date, issued_date, paid_date, service_type').order('created_at', { ascending: false })
      const filtered = (data ?? []).filter(i =>
        i.company?.toLowerCase().includes(q) ||
        (input.status && i.status === input.status)
      )
      if (filtered.length === 0) return 'No invoices found matching that search.'
      return JSON.stringify(filtered.slice(0, 20))
    }

    case 'search_tickets': {
      const q = (input.query as string).toLowerCase()
      const { data } = await db.from('tickets').select('id, subject, company, status, priority, assigned_to, created_date').order('created_at', { ascending: false })
      const filtered = (data ?? []).filter(t =>
        t.subject?.toLowerCase().includes(q) ||
        t.company?.toLowerCase().includes(q) ||
        (input.status && t.status === input.status)
      )
      if (filtered.length === 0) return 'No tickets found matching that search.'
      return JSON.stringify(filtered.slice(0, 20))
    }

    case 'get_dashboard_summary': {
      const [deals, invoices, contracts, renewals, projects] = await Promise.all([
        db.from('deals').select('id, stage, value'),
        db.from('invoices').select('id, status, amount, due_date'),
        db.from('contracts').select('id, status, value'),
        db.from('renewals').select('id, status, days_until_expiry, company, expiration_date'),
        db.from('projects').select('id, status, company'),
      ])

      const allDeals = deals.data ?? []
      const allInvoices = invoices.data ?? []
      const allContracts = contracts.data ?? []
      const allRenewals = renewals.data ?? []
      const allProjects = projects.data ?? []

      const pipelineValue = allDeals.filter(d => !['Closed Won', 'Closed Lost'].includes(d.stage)).reduce((sum, d) => sum + (d.value || 0), 0)
      const closedWonValue = allDeals.filter(d => d.stage === 'Closed Won').reduce((sum, d) => sum + (d.value || 0), 0)
      const overdueInvoices = allInvoices.filter(i => i.status === 'Overdue')
      const overdueTotal = overdueInvoices.reduce((sum, i) => sum + (i.amount || 0), 0)
      const activeProjects = allProjects.filter(p => ['In Progress', 'Awaiting Client'].includes(p.status))
      const upcomingRenewals = allRenewals.filter(r => r.status === 'Upcoming' && (r.days_until_expiry ?? 999) <= 60)

      return JSON.stringify({
        totalDeals: allDeals.length,
        pipelineValue,
        closedWonValue,
        totalInvoices: allInvoices.length,
        overdueInvoices: overdueInvoices.length,
        overdueTotal,
        activeContracts: allContracts.filter(c => c.status === 'Fully Executed').length,
        activeProjects: activeProjects.length,
        upcomingRenewals: upcomingRenewals.length,
        renewalDetails: upcomingRenewals.slice(0, 5),
      })
    }

    case 'generate_document': {
      const docType = input.document_type as string
      const clientName = input.client_name as string
      const data = (input.data ?? {}) as Record<string, string>

      const { data: templates } = await db
        .from('document_templates')
        .select('*')
        .eq('type', docType)
        .eq('is_default', true)
        .limit(1)

      const template = templates?.[0]
      if (!template) {
        return `No default template found for type "${docType}". Available types: proposal, contract, addendum.`
      }

      let filled = template.body as string
      filled = filled.replace(/\[CLIENT NAME\]/g, clientName)
      filled = filled.replace(/\[DATE\]/g, data.date ?? new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))

      // Replace all other bracket placeholders with provided data
      for (const [key, value] of Object.entries(data)) {
        const placeholder = `[${key.toUpperCase()}]`
        filled = filled.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value)
      }

      return `--- GENERATED ${template.name.toUpperCase()} ---\n\n${filled}`
    }

    case 'list_templates': {
      const { data } = await db
        .from('document_templates')
        .select('id, name, type, version, is_default, created_at')
        .order('type')
      if (!data || data.length === 0) return 'No document templates found. Run the seed-templates.sql script to install the default templates.'
      return JSON.stringify(data)
    }

    case 'write_proposal': {
      const company = input.company_name as string
      const services = input.services as string
      const budget = (input.budget as string) || 'to be discussed'
      const timeline = (input.timeline as string) || 'to be determined'
      const context = (input.context as string) || ''

      // Look up company data from CRM for additional context
      const { data: companyData } = await db
        .from('crm_companies')
        .select('name, industry, website, hq, size, description')
        .ilike('name', `%${company}%`)
        .limit(1)

      const companyInfo = companyData?.[0]
      const companyContext = companyInfo
        ? `\nCompany Details from CRM:\n- Industry: ${companyInfo.industry || 'Unknown'}\n- Website: ${companyInfo.website || 'N/A'}\n- Location: ${companyInfo.hq || 'Unknown'}\n- Size: ${companyInfo.size || 'Unknown'}\n- Description: ${companyInfo.description || 'N/A'}`
        : ''

      const proposalPrompt = `Write a professional marketing services proposal for ${company}.

Services requested: ${services}
Budget: ${budget}
Timeline: ${timeline}
${context ? `Additional context: ${context}` : ''}
${companyContext}

Write the proposal in this format:
1. **Executive Summary** - Brief overview of what Graviss Marketing will deliver
2. **Understanding Your Needs** - Show understanding of the client's business and goals
3. **Proposed Services** - Detail each service with scope and deliverables
4. **Timeline & Milestones** - Phase-by-phase breakdown
5. **Investment** - Pricing breakdown (use the budget info provided)
6. **Why Graviss Marketing** - Brief value proposition
7. **Next Steps** - Clear call to action

Keep the tone professional but approachable. Be specific about deliverables. Use the company details from CRM if available to personalize the content.`

      // Make a separate Claude call to generate the proposal
      const apiKey = process.env.ANTHROPIC_API_KEY
      if (!apiKey) return 'API key not configured for proposal generation.'

      const proposalRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          messages: [{ role: 'user', content: proposalPrompt }],
        }),
      })

      if (!proposalRes.ok) {
        return 'Failed to generate proposal content. Please try again.'
      }

      const proposalData = await proposalRes.json() as { content: Array<{ type: string; text?: string }> }
      const proposalText = proposalData.content.filter(c => c.type === 'text').map(c => c.text).join('')

      return `--- AI-GENERATED PROPOSAL FOR ${company.toUpperCase()} ---\n\n${proposalText}`
    }

    default:
      return `Unknown tool: ${name}`
  }
}

// ─── Main handler ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { messages } = (await req.json()) as ChatRequest

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'messages are required' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        reply: 'The AI assistant requires an Anthropic API key. Please set ANTHROPIC_API_KEY in your environment variables.',
        source: 'error',
      })
    }

    const systemPrompt = `You are GravHub AI, the intelligent assistant built into GravHub — the operating system for Graviss Marketing, a full-service digital marketing agency based in Florida.

You have access to the full CRM, pipeline, billing, project, and document systems through your tools. You can:

1. **Search & Lookup** — Find companies, contacts, deals, contracts, proposals, invoices, projects, and tickets instantly.
2. **Dashboard Intelligence** — Provide real-time business summaries (pipeline value, overdue invoices, upcoming renewals, etc.).
3. **Document Generation** — Generate proposals, service agreements (contracts), and contract addendums from templates, OR write fully custom AI-generated proposals using the write_proposal tool. When the user asks to "write" or "create" a proposal with custom content, use write_proposal. When they want a template-based document, use generate_document.
4. **Analysis & Advice** — Provide strategic recommendations based on the data you find.

Guidelines:
- Be concise and professional. Use tables and formatting when presenting data.
- When asked to find something, use the appropriate search tool rather than guessing.
- When asked to create a document, use generate_document with the client's real data from the CRM.
- Format currency with $ and commas. Format dates in Month Day, Year format.
- If you can't find data, say so clearly rather than making it up.
- You are speaking to internal Graviss Marketing team members.`

    // Convert to Anthropic format — use `unknown` for content since tool-use
    // turns send structured content blocks, not plain strings.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type AnthropicMessage = { role: 'user' | 'assistant'; content: any }
    const anthropicMessages: AnthropicMessage[] = messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

    // Agentic loop — keep calling Claude until it stops using tools
    let currentMessages: AnthropicMessage[] = [...anthropicMessages]
    let finalText = ''
    const maxIterations = 10

    for (let i = 0; i < maxIterations; i++) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          system: systemPrompt,
          tools: TOOLS,
          messages: currentMessages,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }))
        console.error('[ai/chat] Anthropic API error:', res.status, JSON.stringify(err))
        const detail = err?.error?.message || err?.error?.type || `HTTP ${res.status}`
        return NextResponse.json({
          reply: `Sorry, there was an error communicating with the AI (${detail}). Please try again.`,
          source: 'error',
        })
      }

      const data = await res.json() as {
        content: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>
        stop_reason: string
      }

      // If no tool use, extract text and return
      if (data.stop_reason === 'end_turn' || !data.content.some(c => c.type === 'tool_use')) {
        finalText = data.content.filter(c => c.type === 'text').map(c => c.text).join('')
        break
      }

      // Process tool calls
      const toolResults: Array<{ type: 'tool_result'; tool_use_id: string; content: string }> = []

      for (const block of data.content) {
        if (block.type === 'tool_use' && block.id && block.name) {
          const result = await executeTool(block.name, block.input ?? {})
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: result,
          })
        }
      }

      // Also extract any text from this turn
      const turnText = data.content.filter(c => c.type === 'text').map(c => c.text).join('')
      if (turnText) finalText = turnText

      // Append assistant response and tool results to conversation
      currentMessages = [
        ...currentMessages,
        { role: 'assistant' as const, content: data.content },
        { role: 'user' as const, content: toolResults },
      ]
    }

    return NextResponse.json({ reply: finalText, source: 'ai' })
  } catch (err) {
    console.error('[ai/chat]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
