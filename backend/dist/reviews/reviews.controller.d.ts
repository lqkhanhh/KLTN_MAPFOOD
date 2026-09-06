import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { CreateReviewDto } from './dto';
import { ReviewsService } from './reviews.service';
export declare class ReviewsController {
    private readonly reviewsService;
    constructor(reviewsService: ReviewsService);
    create(dto: CreateReviewDto, user: AuthenticatedUser): Promise<import("../database/entities").Review>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
