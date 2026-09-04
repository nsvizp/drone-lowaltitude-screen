import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // 管理员账号：admin / Admin@2026（bcrypt）
  await prisma.user.upsert({
    where: { username: 'admin' },
    create: {
      username: 'admin',
      passwordHash: await bcrypt.hash('Admin@2026', 10),
      displayName: 'Admin',
      role: 'admin',
    },
    update: {},
  })

  // 公开配置：高德 key（从前端 .env.local 迁入数据库）
  await prisma.systemConfig.upsert({
    where: { key: 'amap.key' },
    create: {
      key: 'amap.key',
      value: 'b54fe350f613dfe61c5ebf4753fd9362',
      isSecret: false,
      description: '高德 JS API Key（前端加载地图用；防盗刷靠高德后台域名白名单）',
    },
    update: {},
  })

  console.log('[seed] done: user admin, config amap.key')
}

main().finally(() => prisma.$disconnect())
