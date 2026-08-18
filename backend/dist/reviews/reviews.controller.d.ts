import { CreateReviewDto } from './dto';
import { ReviewsService } from './reviews.service';
export declare class ReviewsController {
    private service;
    constructor(service: ReviewsService);
    create(dto: CreateReviewDto, u: any): Promise<import("../database/entities").Review>;
}
