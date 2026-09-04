import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'

@Injectable()
export class ConfigService {
  constructor(private readonly prisma: PrismaService) {}

  /** 公开配置：只放行 is_secret=false 的项（高德 key 等） */
  async getPublic(): Promise<Record<string, string>> {
    const rows = await this.prisma.systemConfig.findMany({ where: { isSecret: false } })
    return Object.fromEntries(rows.map((r) => [r.key, r.value]))
  }

  async get(key: string): Promise<string | null> {
    const row = await this.prisma.systemConfig.findUnique({ where: { key } })
    return row?.value ?? null
  }

  async set(key: string, value: string, opts?: { isSecret?: boolean; description?: string; updatedBy?: string }) {
    return this.prisma.systemConfig.upsert({
      where: { key },
      create: { key, value, isSecret: opts?.isSecret ?? false, description: opts?.description ?? '', updatedBy: opts?.updatedBy ?? 'system' },
      update: { value, updatedBy: opts?.updatedBy ?? 'system' },
    })
  }
}
