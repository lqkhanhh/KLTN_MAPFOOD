import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { User, UserRole } from '../database/entities/user.entity';
import { LoginDto, RegisterDto } from './dto';
export declare class AuthService {
    private readonly users;
    private readonly jwtService;
    constructor(users: Repository<User>, jwtService: JwtService);
    register(dto: RegisterDto): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: string;
            email: string;
            fullName: string;
            phone: string | undefined;
            role: UserRole;
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
            role: UserRole;
        };
    }>;
    refresh(refreshToken: string): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: string;
            email: string;
            fullName: string;
            phone: string | undefined;
            role: UserRole;
        };
    }>;
    upgradeToMerchant(userId: string): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: string;
            email: string;
            fullName: string;
            phone: string | undefined;
            role: UserRole;
        };
    }>;
    private tokens;
}
