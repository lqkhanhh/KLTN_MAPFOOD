import { Repository } from 'typeorm';
import { Restaurant, Review } from '../database/entities';
import { CreateReviewDto } from './dto';
export declare class ReviewsService {
    private reviews;
    private restaurants;
    constructor(reviews: Repository<Review>, restaurants: Repository<Restaurant>);
    create(dto: CreateReviewDto, userId: string): Promise<Review>;
}
