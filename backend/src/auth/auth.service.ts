import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcryptjs'
import { PrismaService } from '../prisma.service'
import { attemptsLeft, lockRemainSec, LOCK_WINDOW_MS } from './login-lock'

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private async recentFailures(username: string): Promise<number[]> {
    const since = new Date(Date.now() - LOCK_WINDOW_MS - 10 * 60_000)
    const rows = await this.prisma.loginAttempt.findMany({
      where: { username, success: false, createdAt: { gt: since } },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    })
    return rows.map((r) => r.createdAt.getTime())
  }

  async login(username: string, password: string, ip: string) {
    const now = Date.now()
    const failures = await this.recentFailures(username)
    const remain = lockRemainSec({ failures, now })
    if (remain > 0) {
      throw new UnauthorizedException({ message: '账号已锁定', remainSec: remain })
    }

    const user = await this.prisma.user.findUnique({ where: { username } })
    const ok = user !== null && (await bcrypt.compare(password, user.passwordHash))
    await this.prisma.loginAttempt.create({ data: { username, success: ok, ip } })

    if (!ok || !user) {
      const left = attemptsLeft({ failures: [...failures, now], now })
      const remainAfter = lockRemainSec({ failures: [...failures, now], now })
      throw new UnauthorizedException({
        message: remainAfter > 0 ? '连续失败次数过多，账号已锁定' : '用户名或密码错误',
        remainSec: remainAfter,
        attemptsLeft: left,
      })
    }

    return {
      token: await this.jwt.signAsync({ sub: user.id, username: user.username, role: user.role }),
      displayName: user.displayName,
    }
  }
}
