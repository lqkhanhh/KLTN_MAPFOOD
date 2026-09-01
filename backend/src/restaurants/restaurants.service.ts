import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MenuItem, Restaurant, UserRole } from '../database/entities';
import { RestaurantDto } from './dto';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';

@Injectable()
export class RestaurantsService {
  constructor(@InjectRepository(Restaurant) private readonly restaurants: Repository<Restaurant>) {}

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
    return this.restaurants.save(
      this.restaurants.create({
        name: dto.name,
        address: dto.address,
        openingHours: dto.openingHours,
        active: dto.active ?? true,
        ownerId: user.sub,
        location: { type: 'Point', coordinates: [dto.longitude, dto.latitude] },
        menuItems: dto.menuItems?.map((item) => this.restaurants.manager.create(MenuItem, item)),
      }),
    );
  }

  async update(id: string, dto: RestaurantDto, user: AuthenticatedUser) {
    const restaurant = await this.findOne(id);
    if (restaurant.ownerId !== user.sub && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException();
    }
    Object.assign(restaurant, {
      name: dto.name,
      address: dto.address,
      openingHours: dto.openingHours,
      active: dto.active ?? restaurant.active,
      location: { type: 'Point', coordinates: [dto.longitude, dto.latitude] },
    });
    if (dto.menuItems) {
      restaurant.menuItems = dto.menuItems.map((item) =>
        this.restaurants.manager.create(MenuItem, item),
      );
    }
    return this.restaurants.save(restaurant);
  }
}
