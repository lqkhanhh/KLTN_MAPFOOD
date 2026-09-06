export declare class RegisterDto {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
}
export declare class LoginDto {
    email: string;
    password: string;
}
export declare class RefreshDto {
    refreshToken: string;
}
