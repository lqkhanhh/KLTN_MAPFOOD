import { Body, Controller, Module, Post, UseGuards } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { SupportChatDto } from './support.dto';
import { SUPPORT_FETCH, SupportService } from './support.service';

@Controller('support') @UseGuards(JwtAuthGuard)
export class SupportController {
  constructor(private readonly service: SupportService) {}
  @Post('ai-chat') chat(@Body() dto: SupportChatDto, @CurrentUser() user: AuthenticatedUser) { return this.service.chat(dto, user.sub); }
}
@Module({ imports: [AuthModule], controllers: [SupportController], providers: [SupportService, { provide: SUPPORT_FETCH, useValue: fetch }] })
export class SupportModule {}
