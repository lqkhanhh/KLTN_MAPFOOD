import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';

@Injectable()
export class IdentityRateGuard implements CanActivate {
  private readonly attempts = new Map<string, { count: number; expires: number }>();
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const key = request.ip || request.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    for (const [address, entry] of this.attempts) if (entry.expires <= now) this.attempts.delete(address);
    const entry = this.attempts.get(key) || { count: 0, expires: now + 60000 };
    if (entry.count >= 20 || (!this.attempts.has(key) && this.attempts.size >= 10000)) {
      throw new HttpException('Bạn đã thử quá nhiều lần. Vui lòng đợi một phút.', HttpStatus.TOO_MANY_REQUESTS);
    }
    entry.count += 1; this.attempts.set(key, entry);
    return true;
  }
}
