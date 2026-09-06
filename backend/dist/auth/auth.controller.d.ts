import { AuthService } from './auth.service';
import { LoginDto, RefreshDto, RegisterDto } from './dto';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
export declare class AuthController {
    private service;
    constructor(service: AuthService);
    register(dto: RegisterDto): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: string;
            email: string;
            fullName: string;
            phone: string | undefined;
            role: import("../database/entities").UserRole;
        };
    }>;
    login(dto: LoginDto): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: string;
            email: string;
            fullName: string;
            phone: string | undefined;
            role: import("../database/entities").UserRole;
        };
    }>;
    refresh(dto: RefreshDto): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: string;
            email: string;
            fullName: string;
            phone: string | undefined;
            role: import("../database/entities").UserRole;
        };
    }>;
    upgradeToMerchant(user: AuthenticatedUser): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: string;
            email: string;
            fullName: string;
            phone: string | undefined;
            role: import("../database/entities").UserRole;
        };
    }>;
}
