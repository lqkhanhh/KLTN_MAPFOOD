import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { User } from '../database/entities/user.entity';
import { LoginDto, RegisterDto } from './dto';
export declare class AuthService {
    private users;
    private jwt;
    constructor(users: Repository<User>, jwt: JwtService);
    register(dto: RegisterDto): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: string;
            email: string;
            fullName: string;
            role: import("../database/entities/user.entity").UserRole;
        };
    }>;
    login(dto: LoginDto): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: string;
            email: string;
            fullName: string;
            role: import("../database/entities/user.entity").UserRole;
        };
    }>;
    refresh(refreshToken: string): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: string;
            email: string;
            fullName: string;
            role: import("../database/entities/user.entity").UserRole;
        };
    }>;
    private tokens;
}
