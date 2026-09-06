import { CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
export declare class JwtAuthGuard implements CanActivate {
    private jwt;
    constructor(jwt: JwtService);
    canActivate(ctx: ExecutionContext): boolean;
}
export declare class OptionalJwtAuthGuard implements CanActivate {
    private readonly jwt;
    constructor(jwt: JwtService);
    canActivate(ctx: ExecutionContext): boolean;
}
