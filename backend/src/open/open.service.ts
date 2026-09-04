import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { paginate, scaleTask, PERIOD_FACTOR, type Period, type TaskNode } from './scale-task'

function ok<T>(data: T) {
  return { code: 200, msg: '操作成功', data }
}

@Injectable()
export class OpenService {
  constructor(private readonly prisma: PrismaService) {}

  private async feed<T>(key: string): Promise<T> {
    const row = await this.prisma.statFeed.findUnique({ where: { key } })
    if (!row) throw new Error('stat feed missing: ' + key)
    return JSON.parse(row.payload) as T
  }

  /** 接口1：飞行总览统计 */
  async totalDataByDept() {
    return ok(await this.feed('total_data'))
  }

  /** 接口2：分页查询飞行记录（按执行时间降序） */
  async associatedFlyRecord(pageNum = 1, pageSize = 10) {
    const rows = await this.prisma.flightRecord.findMany({ orderBy: { createTime: 'desc' } })
    const page = paginate(rows, pageNum, pageSize)
    return {
      total: page.total,
      rows: page.rows.map((r) => ({
        flyRecordId: r.id,
        flyRecordName: r.name,
        flyLineId: r.routeId,
        flyLineName: r.routeName,
        flyerId: r.flyerId,
        flyerName: r.flyerName,
        createTime: r.createTime,
        shelterId: r.shelterId,
        shelterName: r.shelterName,
      })),
    }
  }

  /** 接口3：各单位工单统计 */
  async workOrderOverview() {
    return ok(await this.feed('workorder_overview'))
  }

  /** 接口4：各单位任务统计（支持时间范围筛选） */
  async taskOverview(period: Period = 'total') {
    const base = await this.feed<TaskNode>('task_overview')
    return ok(scaleTask(base, PERIOD_FACTOR[period] ?? 1))
  }

  /** 接口5：各单位飞行统计 */
  async newTotalDataByDay() {
    return ok(await this.feed('flight_stats'))
  }
}
