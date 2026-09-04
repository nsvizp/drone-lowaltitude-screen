import { DISASTER_NAME, type DisasterKind, type FloodEvent } from '../../../shared/sim/disaster'

/** 给大模型的候选资源上下文（真实机队/仓库/方舱，供其选择） */
export interface LlmContext {
  drones: { id: string; name: string; batteryPct: number; distanceKm: number }[]
  warehouses: { id: string; name: string }[]
  shelters: { id: number; name: string }[]
}

/** 大模型结构化决策（经校验后才采用） */
export interface LlmPlan {
  reasoning: string
  surveyDroneIds: string[]
  supplySiteId: string
  shelterId: number
}

/** 构造灾情研判提示词：真实候选列表 + 强制 JSON 输出格式 */
export function buildDisasterPrompt(flood: FloodEvent, ctx: LlmContext): string {
  const kindName = DISASTER_NAME[flood.kind ?? 'flood']
  return [
    '你是应急指挥调度大模型。灾区发生' + kindName + '（' + flood.severity + ' 级），' +
    '灾点坐标 ' + flood.position[0].toFixed(4) + ', ' + flood.position[1].toFixed(4) + '。',
    '候选巡逻机（id/名称/电量%/距灾点km）：' +
      ctx.drones.map((d) => d.id + '/' + d.name + '/' + d.batteryPct + '/' + d.distanceKm).join('；'),
    '候选物资点：' + ctx.warehouses.map((w) => w.id + '/' + w.name).join('；'),
    '候选方舱：' + ctx.shelters.map((s) => s.id + '/' + s.name).join('；'),
    '请研判灾情并选择：2 架最近且电量充足的勘测机、1 个最合适物资点、1 个起飞方舱。',
    '只输出 JSON（可包裹在 markdown 围栏中）：{"reasoning":"研判过程（中文100字内）","surveyDroneIds":["id1","id2"],"supplySiteId":"id","shelterId":数字}。',
  ].join('\n')
}

/** 防御性解析：提取 JSON + 校验引用的机/仓库/方舱真实存在（不合法 → null，走算法兜底） */
export function parseLlmPlanResponse(raw: string, ctx: LlmContext): LlmPlan | null {
  const m = raw.match(/\{[\s\S]*\}/)
  if (!m) return null
  let obj: unknown
  try { obj = JSON.parse(m[0]) } catch { return null }
  const o = obj as Record<string, unknown>
  if (typeof o.reasoning !== 'string' || !o.reasoning) return null
  if (!Array.isArray(o.surveyDroneIds) || o.surveyDroneIds.length === 0) return null
  const droneIds = new Set(ctx.drones.map((d) => d.id))
  const surveyDroneIds = (o.surveyDroneIds as unknown[]).filter((x): x is string => typeof x === 'string')
  if (surveyDroneIds.length === 0 || !surveyDroneIds.every((id) => droneIds.has(id))) return null
  if (!ctx.warehouses.some((w) => w.id === o.supplySiteId)) return null
  if (!ctx.shelters.some((s) => s.id === o.shelterId)) return null
  return { reasoning: o.reasoning, surveyDroneIds, supplySiteId: o.supplySiteId as string, shelterId: o.shelterId as number }
}

export interface LlmClientResult { content: string }
export type LlmClient = () => Promise<LlmClientResult>

/** 大模型编排：调用 + 超时保护 + 容错（任何失败 → null 走算法兜底） */
export async function analyzeWithLlm(
  deps: { client: LlmClient; timeoutMs: number },
  flood: FloodEvent,
  ctx: LlmContext,
): Promise<LlmPlan | null> {
  try {
    const res = await Promise.race([
      deps.client(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('llm-timeout')), deps.timeoutMs)),
    ])
    return parseLlmPlanResponse(res.content, ctx)
  } catch {
    return null
  }
}

/** OpenAI 兼容端点客户端（env 配置；未配置时返回 null → 算法兜底） */
export function makeOpenAiClient(flood: FloodEvent, ctx: LlmContext): LlmClient | null {
  const baseUrl = process.env.LLM_BASE_URL
  const apiKey = process.env.LLM_API_KEY
  const model = process.env.LLM_MODEL ?? 'deepseek-chat'
  if (!baseUrl || !apiKey) return null
  return async () => {
    const res = await fetch(baseUrl.replace(/\/$/, '') + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: buildDisasterPrompt(flood, ctx) }],
        temperature: 0.3,
      }),
    })
    if (!res.ok) throw new Error('llm-http-' + res.status)
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error('llm-empty')
    return { content }
  }
}
