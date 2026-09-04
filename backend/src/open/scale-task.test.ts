import { describe, expect, it } from 'vitest'
import { paginate, scaleTask } from './scale-task'

const base = {
  deptId: 100, deptName: '省公司', taskTotalNum: 120,
  dispatchedNum: 24, dispatchingNum: 36, receivedNum: 48, completedNum: 12,
  dispatchedPercent: 20, dispatchingPercent: 30, receivedPercent: 40, completedPercent: 10,
  taskOverviewRespVoList: [
    { deptId: 101, deptName: '江心洲', taskTotalNum: 50, dispatchedNum: 10, dispatchingNum: 15, receivedNum: 20, completedNum: 5, dispatchedPercent: 20, dispatchingPercent: 30, receivedPercent: 40, completedPercent: 10 },
  ],
}

describe('scaleTask 周期缩放', () => {
  it('total 因子 1 原样返回', () => {
    const r = scaleTask(base, 1)
    expect(r.taskTotalNum).toBe(120)
  })

  it('today 因子 0.08：数值缩放、总量重算、百分比重算', () => {
    const r = scaleTask(base, 0.08)
    expect(r.dispatchedNum).toBe(2) // 24*0.08=1.92→2
    expect(r.taskTotalNum).toBe(r.dispatchedNum + r.dispatchingNum + r.receivedNum + r.completedNum)
    expect(r.dispatchedPercent + r.dispatchingPercent + r.receivedPercent + r.completedPercent).toBeLessThanOrEqual(101)
    // 子节点同步缩放
    expect(r.taskOverviewRespVoList![0].dispatchedNum).toBe(1) // 10*0.08=0.8→1
  })

  it('零总量不除零', () => {
    const r = scaleTask({ ...base, dispatchedNum: 0, dispatchingNum: 0, receivedNum: 0, completedNum: 0 }, 0.5)
    expect(r.taskTotalNum).toBe(0)
    expect(r.dispatchedPercent).toBe(0)
  })
})

describe('paginate 分页', () => {
  it('按页切片并返回总数', () => {
    const rows = Array.from({ length: 25 }, (_, i) => i)
    expect(paginate(rows, 1, 10).rows).toHaveLength(10)
    expect(paginate(rows, 3, 10).rows).toHaveLength(5)
    expect(paginate(rows, 1, 10).total).toBe(25)
  })
})
