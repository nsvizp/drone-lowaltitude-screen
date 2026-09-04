import { Body, Controller, Ip, Post, UnauthorizedException } from '@nestjs/common'
import { AuthService } from './auth.service'

interface LoginBody {
  username?: string
  password?: string
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  async login(@Body() body: LoginBody, @Ip() ip: string) {
    if (!body.username || !body.password) {
      throw new UnauthorizedException('请输入用户名和密码')
    }
    return this.auth.login(body.username, body.password, ip)
  }
}
