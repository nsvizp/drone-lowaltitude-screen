import { Controller, Get } from '@nestjs/common'
import { Public } from '../auth/public.decorator'
import { ConfigService } from './config.service'

@Controller('config')
export class ConfigController {
  constructor(private readonly config: ConfigService) {}

  /** 前端启动时拉取公开配置（含高德 key、大模型标识），无需登录 */
  @Public()
  @Get('public')
  async getPublic() {
    const rows = await this.config.getPublic()
    return {
      ...rows,
      // 大模型标识（仅模型 ID 与开关，绝不下发密钥）
      'llm.model': process.env.LLM_MODEL ?? '',
      'llm.on': process.env.LLM_BASE_URL ? '1' : '',
    }
  }
}
