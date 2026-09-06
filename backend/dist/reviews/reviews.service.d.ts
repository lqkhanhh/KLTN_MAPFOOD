import { DataSource } from 'typeorm';
import { Review } from '../database/entities';
import { CreateReviewDto } from './dto';
export declare class ReviewsService {
    private readonly dataSource;
    constructor(dataSource: DataSource);
    create(dto: CreateReviewDto, userId: string): Promise<Review>;
    removeByAdmin(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
    private isUniqueViolation;
}
