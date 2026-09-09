import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Favorite } from './favorite.entity';
import { Restaurant } from '../database/entities/restaurant.entity';
import { User } from '../database/entities/user.entity';

@Injectable()
export class FavoritesService {
  constructor(@InjectRepository(Favorite) private readonly favorites: Repository<Favorite>,
    @InjectRepository(Restaurant) private readonly restaurants: Repository<Restaurant>) {}

  async list(userId: string) {
    await this.assertUser(userId);
    const rows = await this.favorites.find({ where: { userId }, relations: ['restaurant'], order: { createdAt: 'DESC', id: 'ASC' } });
    // Giữ quán ngừng hoạt động trong danh sách để khách vẫn có thể bỏ lưu.
    return rows.map((row) => row.restaurant);
  }

  async add(userId: string, restaurantId: string) {
    await this.assertUser(userId);
    const restaurant = await this.restaurants.findOneBy({ id: restaurantId, active: true, suspendedAt: IsNull(), suspendedReason: IsNull() });
    if (!restaurant) throw new NotFoundException('Quán không tồn tại hoặc đã ngừng hoạt động.');
    // Hai lần bấm/gửi lại cùng yêu cầu không tạo bản ghi trùng.
    await this.favorites.createQueryBuilder().insert().values({ userId, restaurantId })
      .onConflict('("userId", "restaurantId") DO NOTHING').execute();
    return restaurant;
  }

  async remove(userId: string, restaurantId: string) {
    await this.assertUser(userId);
    await this.favorites.delete({ userId, restaurantId });
    return { success: true };
  }

  private async assertUser(userId: string) {
    if (!isUUID(userId) || !await this.favorites.manager.getRepository(User).existsBy({ id: userId })) {
      throw new UnauthorizedException('Tài khoản không còn hợp lệ. Vui lòng đăng nhập lại.');
    }
  }
}
