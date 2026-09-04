import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'

/**
 * 全局 JWT 认证守卫：除 @Public() 白名单外，所有 HTTP 接口要求 Bearer token。
 * 验证通过后把用户负载挂到 request.user。
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>('dsh:isPublic', [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const req = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; user?: unknown }>()
    const header = req.headers.authorization
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined
    if (!token) throw new UnauthorizedException('缺少认证令牌')
    try {
      req.user = await this.jwt.verifyAsync(token)
      return true
    } catch {
      throw new UnauthorizedException('令牌无效或已过期')
    }
  }
}
