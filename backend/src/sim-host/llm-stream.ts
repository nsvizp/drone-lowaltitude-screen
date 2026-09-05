/** 大模型流式增量：reasoning=思维链 / content=正文 */
export interface StreamDelta { kind: 'reasoning' | 'content'; text: string }

/** 增量 SSE 解析器：跨 chunk 缓冲不完整行，逐 data 帧回调 delta；[DONE]/空帧忽略 */
export function createSseParser(onDelta: (d: StreamDelta) => void): (chunk: string) => void {
  let buffer = ''
  return (chunk: string) => {
    buffer += chunk
    let idx: number
    while ((idx = buffer.indexOf('\n\n')) >= 0) {
      const frame = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 2)
      const line = frame.split('\n').find((l) => l.startsWith('data: '))
      if (!line) continue
      const payload = line.slice(6).trim()
      if (payload === '[DONE]') continue
      try {
        const obj = JSON.parse(payload) as { choices?: { delta?: { reasoning_content?: string; content?: string } }[] }
        const delta = obj.choices?.[0]?.delta
        if (delta?.reasoning_content) onDelta({ kind: 'reasoning', text: delta.reasoning_content })
        if (delta?.content) onDelta({ kind: 'content', text: delta.content })
      } catch { /* 半帧/噪声行忽略 */ }
    }
  }
}
