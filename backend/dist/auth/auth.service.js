"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const bcrypt = require("bcrypt");
const jwt_1 = require("@nestjs/jwt");
const user_entity_1 = require("../database/entities/user.entity");
let AuthService = class AuthService {
    constructor(users, jwt) {
        this.users = users;
        this.jwt = jwt;
    }
    async register(dto) { if (await this.users.findOneBy({ email: dto.email }))
        throw new common_1.ConflictException('Email đã tồn tại'); const user = await this.users.save(this.users.create({ ...dto, passwordHash: await bcrypt.hash(dto.password, 10) })); return this.tokens(user); }
    async login(dto) { const user = await this.users.findOneBy({ email: dto.email }); if (!user || !(await bcrypt.compare(dto.password, user.passwordHash)))
        throw new common_1.UnauthorizedException('Email hoặc mật khẩu không đúng'); return this.tokens(user); }
    async refresh(refreshToken) { try {
        const data = this.jwt.verify(refreshToken, { secret: process.env.JWT_REFRESH_SECRET });
        const user = await this.users.findOneByOrFail({ id: data.sub });
        if (!user.refreshTokenHash || !(await bcrypt.compare(refreshToken, user.refreshTokenHash)))
            throw new Error();
        return this.tokens(user);
    }
    catch {
        throw new common_1.UnauthorizedException('Refresh token không hợp lệ');
    } }
    async tokens(user) { const payload = { sub: user.id, email: user.email, role: user.role }; const accessToken = this.jwt.sign(payload, { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '15m' }); const refreshToken = this.jwt.sign(payload, { secret: process.env.JWT_REFRESH_SECRET, expiresIn: '30d' }); user.refreshTokenHash = await bcrypt.hash(refreshToken, 10); await this.users.save(user); return { accessToken, refreshToken, user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role } }; }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository, jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map