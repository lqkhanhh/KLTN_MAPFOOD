import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsString, IsUUID, Length } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { MessagesService } from './messages.service';

export class SendMessageDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @Length(1, 2000) content: string;
}
export class ReadMessagesDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200) @ArrayUnique() @IsUUID('all', { each: true }) messageIds: string[];
}
@ApiTags('messages') @ApiBearerAuth() @UseGuards(JwtAuthGuard)
@Controller('orders/:orderId/messages')
export class MessagesController {
  constructor(private readonly service: MessagesService) {}
  @Get() list(@Param('orderId', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) { return this.service.list(id, user.sub); }
  @Post() send(@Param('orderId', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: SendMessageDto) {
    return this.service.send(id, user.sub, dto.content);
  }
  @Patch('read') read(@Param('orderId', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: ReadMessagesDto) {
    return this.service.read(id, user.sub, dto.messageIds);
  }
}

@ApiTags('messages') @ApiBearerAuth() @UseGuards(JwtAuthGuard)
@Controller('messages')
export class ConversationsController {
  constructor(private readonly service: MessagesService) {}
  @Get('conversations') list(@CurrentUser() user: AuthenticatedUser) { return this.service.conversations(user.sub); }
}
