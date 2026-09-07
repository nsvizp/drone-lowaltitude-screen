import type { DispatchPlan, FloodEvent } from './disaster'
import type { DroneState } from './drone-sim'
import type { SituationState } from './situation'

/** 大模型分析状态：执行调度仍以规则方案和人工确认为准。 */
export type AiDecisionStatus = 'idle' | 'analyzing' | 'ready' | 'fallback'

export type AiDecisionSource = 'model' | 'rule-fallback'

/** 前端展示的大模型结构化分析结果。 */
export interface AiDecisionResult {
  source: AiDecisionSource
  model: string
  generatedAt: string
  latencyMs: number
  situationAssessment: string
  supplyAssessment: string
  personnelAssessment: string
  vehicleAssessment: string
  routeAssessment: string
  recommendation: string
  risks: string[]
  confidence: number
  /** 模型不可用或响应不合规时记录降级原因，不包含密钥等敏感信息。 */
  fallbackReason?: string
}

export interface ResourceSummary {
  supplies: { name: string; detail: string; stock?: number; status: string }[]
  operators: { id: number; name: string; status: '可调度' | '拟调度' | '离线'; lastMission: string }[]
  personnel: Record<string, number>
  vehicles: Record<string, number>
}

/** 发送给模型的受控上下文，只包含生成建议所需的业务数据。 */
export interface EmergencyDecisionContext {
  disaster: FloodEvent
  situation: SituationState
  candidatePlan: DispatchPlan
  fleet: Pick<DroneState, 'id' | 'name' | 'status' | 'mission' | 'batteryPct' | 'lng' | 'lat' | 'routeName'>[]
  resources: ResourceSummary
  constraints: {
    surveyMinBattery: number
    surveyTeamSize: number
    deliveryTeamSize: number
    humanConfirmationRequired: true
  }
}
