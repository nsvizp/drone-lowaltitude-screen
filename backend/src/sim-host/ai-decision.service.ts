import { Injectable } from '@nestjs/common'
import { DISASTER_NAME } from '../../../shared/sim/disaster'
import type { AiDecisionResult, EmergencyDecisionContext } from '../../../shared/sim/ai-decision'

interface ModelDecisionPayload {
  situationAssessment: string
  supplyAssessment: string
  personnelAssessment: string
  vehicleAssessment: string
  routeAssessment: string
  recommendation: string
  risks: string[]
  confidence: number
}

const DECISION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'situationAssessment',
    'supplyAssessment',
    'personnelAssessment',
    'vehicleAssessment',
    'routeAssessment',
    'recommendation',
    'risks',
    'confidence',
  ],
  properties: {
    situationAssessment: { type: 'string' },
    supplyAssessment: { type: 'string' },
    personnelAssessment: { type: 'string' },
    vehicleAssessment: { type: 'string' },
    routeAssessment: { type: 'string' },
    recommendation: { type: 'string' },
    risks: { type: 'array', maxItems: 6, items: { type: 'string' } },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
  },
} as const

const SYSTEM_PROMPT = `你是无人机应急指挥辅助决策模型。输入 JSON 中 fleet 是当前无人机实时状态，resources.operators 是操作员状态，resources.supplies 是物资库存，resources.personnel 与 resources.vehicles 是救援力量状态，situation 是现场态势。
请严格依据这些事实分析，不得虚构无人机、操作员、人员、车辆、库存、距离、数量或状态。
规则引擎给出的 candidatePlan 是唯一可执行候选方案，你只能解释、评估风险并提出人工确认建议，不能更改无人机编号、数量、方舱、物资点和飞手。
表达应简洁、专业、可核验；如果数据不足，必须明确指出。最终只输出符合给定 JSON Schema 的 JSON。`

/** 百炼 OpenAI 兼容接口适配器：只生成解释，调度动作由规则引擎执行。 */
@Injectable()
export class AiDecisionService {
  private get baseUrl(): string {
    return (process.env.LLM_BASE_URL ?? '').replace(/\/$/, '')
  }

  private get apiKey(): string {
    return process.env.LLM_API_KEY ?? ''
  }

  private get model(): string {
    return process.env.LLM_MODEL ?? 'qwen3.7-plus'
  }

  async analyze(
    context: EmergencyDecisionContext,
    options: { forceRuleFallback?: boolean } = {},
  ): Promise<AiDecisionResult> {
    const startedAt = Date.now()
    // 演示开关仅跳过本次模型调用，不修改模型地址、密钥等运行配置。
    if (options.forceRuleFallback) {
      return this.fallback(context, startedAt, '演示模式：已强制使用规则算法兜底')
    }
    if (!this.baseUrl || !this.apiKey) {
      return this.fallback(context, startedAt, '后端未配置大模型地址或 API Key')
    }

    const controller = new AbortController()
    const timeoutMs = Number(process.env.LLM_TIMEOUT_MS ?? 90000)
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(this.baseUrl + '/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.1,
          max_tokens: 1600,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: '请分析以下应急上下文，并以 JSON 返回：\n' + JSON.stringify(context) },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'emergency_decision',
              strict: true,
              schema: DECISION_SCHEMA,
            },
          },
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(await this.providerError(response))
      }

      const body = await response.json() as {
        choices?: { message?: { content?: string | { text?: string }[] } }[]
      }
      const content = body.choices?.[0]?.message?.content
      const text = typeof content === 'string'
        ? content
        : Array.isArray(content) ? content.map((item) => item.text ?? '').join('') : ''
      const payload = this.validatePayload(this.parseJson(text))
      return {
        source: 'model',
        model: this.model,
        generatedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        ...payload,
      }
    } catch (error) {
      const reason = error instanceof Error && error.name === 'AbortError'
        ? '模型请求超时'
        : error instanceof Error ? error.message : '模型请求失败'
      return this.fallback(context, startedAt, reason)
    } finally {
      clearTimeout(timer)
    }
  }

  private parseJson(text: string): unknown {
    const normalized = text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '')
    if (!normalized) throw new Error('模型返回内容为空')
    return JSON.parse(normalized)
  }

  /** 将供应商错误转换为可展示信息，不回传请求头或密钥。 */
  private async providerError(response: Response): Promise<string> {
    const body = await response.json().catch(() => null) as { error?: { code?: string; message?: string } } | null
    if (body?.error?.code === 'Arrearage') return '百炼账号欠费或未开通可用额度'
    if (body?.error?.code === 'AccessDenied.Unpurchased') return '当前百炼工作空间尚未开通该模型的调用权限'
    if (body?.error?.code === 'invalid_parameter_error' && body.error.message?.includes('Workspace endpoint')) {
      return '百炼工作空间 Base URL 无效'
    }
    if (body?.error?.code === 'InvalidApiKey') return '百炼 API Key 无效'
    return body?.error?.code
      ? '模型服务错误：' + body.error.code
      : '模型服务返回 HTTP ' + response.status
  }

  private validatePayload(value: unknown): ModelDecisionPayload {
    if (!value || typeof value !== 'object') throw new Error('模型返回结构无效')
    const row = value as Record<string, unknown>
    const stringField = (name: string): string => {
      const field = row[name]
      if (typeof field !== 'string' || !field.trim()) throw new Error('模型字段 ' + name + ' 无效')
      return field.trim().slice(0, 800)
    }
    const risks = Array.isArray(row.risks)
      ? row.risks.filter((item): item is string => typeof item === 'string' && item.trim() !== '').slice(0, 6)
      : []
    const confidence = typeof row.confidence === 'number' && Number.isFinite(row.confidence)
      ? Math.max(0, Math.min(1, row.confidence))
      : 0.5
    return {
      situationAssessment: stringField('situationAssessment'),
      supplyAssessment: stringField('supplyAssessment'),
      personnelAssessment: stringField('personnelAssessment'),
      vehicleAssessment: stringField('vehicleAssessment'),
      routeAssessment: stringField('routeAssessment'),
      recommendation: stringField('recommendation'),
      risks,
      confidence,
    }
  }

  /** 模型不可用时返回完全由当前数据生成的可核验说明。 */
  private fallback(context: EmergencyDecisionContext, startedAt: number, reason: string): AiDecisionResult {
    const { disaster, situation, candidatePlan, resources, fleet } = context
    const surveyNames = candidatePlan.survey.map((item) => item.droneName).join('、') || '无可用勘测机'
    const delivery = candidatePlan.delivery
    const personnel = Object.entries(resources.personnel).map(([status, count]) => status + ' ' + count + ' 组').join('、')
    const operators = resources.operators.map((operator) => operator.name + ' ' + operator.status).join('、')
    const vehicles = Object.entries(resources.vehicles).map(([status, count]) => status + ' ' + count + ' 台').join('、')
    const patrolCount = fleet.filter((drone) => drone.mission === 'patrol' && drone.status !== 'docked').length
    const risks = candidatePlan.warnings.length > 0 ? candidatePlan.warnings : ['执行前需再次核验无人机电量、空域和物资库存']
    return {
      source: 'rule-fallback',
      model: this.model,
      generatedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      situationAssessment: DISASTER_NAME[disaster.kind] + ' ' + 'ⅠⅡⅢ'[disaster.severity - 1] + ' 级；当前水位 ' + situation.waterLevelM.toFixed(1) + ' 米、影响面积 ' + situation.areaKm2.toFixed(2) + ' 平方公里、估算被困 ' + situation.trapped + ' 人。',
      supplyAssessment: delivery
        ? '规则方案选择 ' + delivery.supplySiteName + '，物资为 ' + delivery.supplyDetail + '，计划由 ' + delivery.shelterName + ' 出动 ' + delivery.droneCount + ' 架投送机。'
        : '当前没有形成可执行的物资投送方案。',
      personnelAssessment: '操作员：' + (operators || '暂无操作员状态数据') + '；救援人员：' + (personnel || '暂无救援人员状态数据') + '。',
      vehicleAssessment: vehicles || '暂无应急车辆状态数据。',
      routeAssessment: '当前巡逻机 ' + patrolCount + ' 架；拟改派 ' + surveyNames + ' 执行勘测' + (delivery ? '，投送航程 ' + delivery.totalKm + ' 公里、预计 ' + delivery.etaMinutes + ' 分钟。' : '。'),
      recommendation: candidatePlan.warnings.length > 0
        ? '候选方案存在资源缺口，建议人工复核警告后再决定是否执行。'
        : '候选方案通过基础规则校验，建议指挥人员复核后下达。',
      risks,
      confidence: candidatePlan.warnings.length > 0 ? 0.55 : 0.72,
      fallbackReason: reason.slice(0, 300),
    }
  }
}
