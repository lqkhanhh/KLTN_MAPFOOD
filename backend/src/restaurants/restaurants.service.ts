import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { MenuItem, Restaurant, UserRole } from '../database/entities';
import { PublicRestaurantsQueryDto, RestaurantDto } from './dto';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';

@Injectable()
export class RestaurantsService {
  constructor(@InjectRepository(Restaurant) private readonly restaurants: Repository<Restaurant>) {}

  async findPublic(query: PublicRestaurantsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const qb = this.restaurants
      .createQueryBuilder('restaurant')
      .leftJoinAndSelect('restaurant.menuItems', 'menuItems')
      .where('restaurant.active = :active', { active: true });

    if (query.category?.trim()) {
      qb.andWhere('restaurant.category = :category', { category: query.category.trim() });
    }
    if (query.search?.trim()) {
      const search = `%${query.search.trim()}%`;
      qb.andWhere(
        new Brackets((where) =>
          where
            .where('restaurant.name ILIKE :search', { search })
            .orWhere('menuItems.name ILIKE :search', { search }),
        ),
      );
    }

    const [data, total] = await qb
      .orderBy('restaurant.rating', 'DESC')
      .addOrderBy('restaurant.reviewCount', 'DESC')
      .addOrderBy('restaurant.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { data, total, page, limit };
  }

  findMine(user: AuthenticatedUser) {
    return this.restaurants.find({
      where: user.role === UserRole.ADMIN ? {} : { ownerId: user.sub },
      relations: ['menuItems'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const restaurant = await this.restaurants.findOne({
      where: { id },
      relations: ['menuItems', 'reviews'],
    });
    if (!restaurant) throw new NotFoundException('Không tìm thấy quán');
    return restaurant;
  }

  create(dto: RestaurantDto, user: AuthenticatedUser) {
    if (dto.menuItems?.some((item) => item.id)) throw new BadRequestException('Món của quán mới không được có id có sẵn');
    return this.restaurants.save(
      this.restaurants.create({
        name: dto.name,
        address: dto.address,
        category: dto.category?.trim() || undefined,
        imageUrl: dto.imageUrl?.trim() || undefined,
        openingHours: dto.openingHours,
        active: dto.active ?? true,
        ownerId: user.sub,
        location: { type: 'Point', coordinates: [dto.longitude, dto.latitude] },
        menuItems: dto.menuItems?.map((item) => this.restaurants.manager.create(MenuItem, item)),
      }),
    );
  }

  async update(id: string, dto: RestaurantDto, user: AuthenticatedUser) {
    return this.restaurants.manager.transaction(async (manager) => {
    const restaurant = await manager.findOne(Restaurant, { where: { id }, lock: { mode: 'pessimistic_write' } });
    if (!restaurant) throw new NotFoundException('Không tìm thấy quán');
    if (restaurant.ownerId !== user.sub && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException();
    }
    Object.assign(restaurant, {
      name: dto.name,
      address: dto.address,
      category: dto.category?.trim() || undefined,
      imageUrl: dto.imageUrl !== undefined ? dto.imageUrl?.trim() || null : restaurant.imageUrl,
      openingHours: dto.openingHours,
      active: dto.active ?? restaurant.active,
      location: { type: 'Point', coordinates: [dto.longitude, dto.latitude] },
    });
    await manager.save(Restaurant, restaurant);
    if (dto.menuItems !== undefined) {
      const existing = await manager.find(MenuItem, { where: { restaurantId: id } });
      const ids = dto.menuItems.flatMap((item) => item.id ? [item.id] : []);
      if (new Set(ids).size !== ids.length || ids.some((itemId) => !existing.some((item) => item.id === itemId))) {
        throw new BadRequestException('Danh sách món có id trùng hoặc không thuộc quán này');
      }
      if (dto.menuItems.some((item) => !item.name.trim())) throw new BadRequestException('Tên món không được để trống');
      // Mảng gửi lên là toàn bộ menu. Xóa chỉ các món của quán bị bỏ khỏi mảng;
      // snapshot tên/giá trong đơn cũ được giữ nguyên qua khóa ngoại SET NULL.
      const removed = existing.filter((item) => !ids.includes(item.id)).map((item) => item.id);
      if (removed.length) await manager.delete(MenuItem, { restaurantId: id, id: In(removed) });
      if (dto.menuItems.length) await manager.save(MenuItem, dto.menuItems.map((item) => manager.create(MenuItem, {
        ...item, name: item.name.trim(), restaurantId: id,
      })));
    }
    return manager.findOneOrFail(Restaurant, { where: { id }, relations: ['menuItems'] });
    });
  }
}
