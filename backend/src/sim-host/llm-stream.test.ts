import { describe, expect, it } from 'vitest'
import { createSseParser, type StreamDelta } from './llm-stream'

describe('createSseParser SSE 流解析', () => {
  it('解析思维链与正文 delta', () => {
    const got: StreamDelta[] = []
    const push = createSseParser((d) => got.push(d))
    push('data: {"choices":[{"delta":{"reasoning_content":"先想"}}]}\n\n')
    push('data: {"choices":[{"delta":{"content":"{\\"reasoning"}}]}\n\n')
    expect(got).toEqual([
      { kind: 'reasoning', text: '先想' },
      { kind: 'content', text: '{"reasoning' },
    ])
  })

  it('跨 chunk 不完整的行缓冲拼接', () => {
    const got: StreamDelta[] = []
    const push = createSseParser((d) => got.push(d))
    push('data: {"choices":[{"delta":{"reasoning_content":"思维')
    push('链片段"}}]}\n\ndata: {"choices":[{"delta":{"content":"A"}}]}\n\n')
    expect(got).toEqual([
      { kind: 'reasoning', text: '思维链片段' },
      { kind: 'content', text: 'A' },
    ])
  })

  it('[DONE] 与空 delta 忽略', () => {
    const got: StreamDelta[] = []
    const push = createSseParser((d) => got.push(d))
    push('data: [DONE]\n\n')
    push('data: {"choices":[{"delta":{}}]}\n\n')
    expect(got).toEqual([])
  })
})
