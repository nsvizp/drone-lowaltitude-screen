import { Controller, Get } from '@nestjs/common'
import { ConfigService } from './config.service'

@Controller('config')
export class ConfigController {
  constructor(private readonly config: ConfigService) {}

  /** 前端启动时拉取公开配置（含高德 key），无需登录 */
  @Get('public')
  getPublic() {
    return this.config.getPublic()
  }
}
