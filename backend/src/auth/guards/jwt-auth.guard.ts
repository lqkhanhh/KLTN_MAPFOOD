import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'; import { JwtService } from '@nestjs/jwt';
@Injectable() export class JwtAuthGuard implements CanActivate { constructor(private jwt: JwtService) {} canActivate(ctx: ExecutionContext) { const token = ctx.switchToHttp().getRequest().headers.authorization?.replace('Bearer ', ''); if (!token) throw new UnauthorizedException(); try { ctx.switchToHttp().getRequest().user = this.jwt.verify(token, { secret: process.env.JWT_ACCESS_SECRET }); return true; } catch { throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn'); } } }

/** Route public vẫn đọc user khi access token hợp lệ để lưu lịch sử cá nhân. */
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(ctx: ExecutionContext) {
    const request = ctx.switchToHttp().getRequest();
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return true;
    try {
      request.user = this.jwt.verify(token, { secret: process.env.JWT_ACCESS_SECRET });
    } catch {
      // Public endpoint không chặn khách chỉ vì token local đã hết hạn.
    }
    return true;
  }
}
