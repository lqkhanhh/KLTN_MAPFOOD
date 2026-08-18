import { UserRole } from '../database/entities/user.entity';
export declare class RegisterDto {
    email: string;
    password: string;
    fullName: string;
    role: UserRole;
}
export declare class LoginDto {
    email: string;
    password: string;
}
export declare class RefreshDto {
    refreshToken: string;
}
