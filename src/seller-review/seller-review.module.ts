import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SellerReviewService } from './seller-review.service';
import { SellerReviewController } from './seller-review.controller';
import { SellerReview, SellerReviewSchema } from './schemas/seller-review.schema';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SellerReview.name, schema: SellerReviewSchema }
    ]),
    UserModule,
  ],
  providers: [SellerReviewService],
  controllers: [SellerReviewController],
  exports: [SellerReviewService],
})
export class SellerReviewModule {}
