import { Controller, Get } from '@nestjs/common'
import { Public } from '../auth/public.decorator'
import { ConfigService } from './config.service'

@Controller('config')
export class ConfigController {
  constructor(private readonly config: ConfigService) {}

  /** 前端启动时拉取公开配置（含高德 key），无需登录 */
  @Public()
  @Get('public')
  getPublic() {
    return this.config.getPublic()
  }
}
