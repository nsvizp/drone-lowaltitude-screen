import { ref } from 'vue'

/** AI 推演阶段（模块级共享）：idle 待机 / running 推演中 / done 推演完成
 *  DispatchCard 草稿确认按钮据此解锁——推演未完成前不可下达 */
export const aiReasoningPhase = ref<'idle' | 'running' | 'done'>('idle')
