import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Patch, Post, Put, Query, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { UserRole } from '../database/entities/user.entity';
import { MerchantApplicationsService } from './merchant-applications.service';
import { ApplicationQueryDto, BankDto, RejectApplicationDto, SaveApplicationDto, SubmitApplicationDto } from './dto';
import { PARTNER_TERMS } from './terms';

@Controller('merchant-applications')
export class MerchantApplicationsController {
  constructor(private readonly service: MerchantApplicationsService) {}
  @Get('terms') terms() { return PARTNER_TERMS; }
  @Get('me') @UseGuards(JwtAuthGuard) @Header('Cache-Control', 'no-store')
  mine(@CurrentUser() user: AuthenticatedUser) { return this.service.mine(user.sub); }
  @Put('me') @UseGuards(JwtAuthGuard)
  save(@CurrentUser() user: AuthenticatedUser, @Body() dto: SaveApplicationDto) { return this.service.save(user.sub, dto); }
  @Put('me/bank') @UseGuards(JwtAuthGuard)
  bank(@CurrentUser() user: AuthenticatedUser, @Body() dto: BankDto) { return this.service.bank(user.sub, dto); }
  @Post('me/documents/:kind') @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 } }))
  upload(@CurrentUser() user: AuthenticatedUser, @Param('kind') kind: string, @UploadedFile() file: { buffer: Buffer; mimetype: string; size: number }) { return this.service.upload(user.sub, kind, file); }
  @Post('me/submit') @UseGuards(JwtAuthGuard)
  submit(@CurrentUser() user: AuthenticatedUser, @Body() dto: SubmitApplicationDto) { return this.service.submit(user.sub, dto); }
  @Get(':id/documents/:documentId') @UseGuards(JwtAuthGuard)
  @Header('Cache-Control', 'no-store') @Header('X-Content-Type-Options', 'nosniff') @Header('Content-Security-Policy', "sandbox; default-src 'none'")
  async document(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Param('documentId', ParseUUIDPipe) documentId: string) {
    const file = await this.service.document(id, documentId, user.sub);
    return new StreamableFile(file.content, { type: file.mimeType, disposition: `attachment; filename="${file.filename}"` });
  }
}

@Controller('admin/merchant-applications') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(UserRole.ADMIN)
export class AdminMerchantApplicationsController {
  constructor(private readonly service: MerchantApplicationsService) {}
  @Get() @Header('Cache-Control', 'no-store') list(@CurrentUser() user: AuthenticatedUser, @Query() query: ApplicationQueryDto) { return this.service.list(user.sub, query); }
  @Get(':id') @Header('Cache-Control', 'no-store') detail(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) { return this.service.detail(id, user.sub); }
  @Patch(':id/approve') approve(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) { return this.service.review(id, user.sub, true); }
  @Patch(':id/reject') reject(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectApplicationDto) { return this.service.review(id, user.sub, false, dto.reason); }
}
