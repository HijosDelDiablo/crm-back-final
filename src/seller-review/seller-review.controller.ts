import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { SellerReviewService } from './seller-review.service';
import { CreateSellerReviewDto } from './dto/create-seller-review.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Rol } from '../auth/enums/rol.enum';
import type { ValidatedUser } from '../user/schemas/user.schema';

@ApiTags('Seller Reviews')
@Controller('seller-review')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SellerReviewController {
  constructor(private readonly sellerReviewService: SellerReviewService) {}

  @Post()
  @Roles(Rol.CLIENTE)
  @ApiOperation({ summary: 'Create a review for a seller (Cliente only)' })
  @ApiBody({ type: CreateSellerReviewDto })
  @ApiResponse({ status: 201, description: 'Review created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed or unauthorized' })
  @ApiResponse({ status: 404, description: 'Seller or client not found' })
  createReview(
    @GetUser() user: ValidatedUser,
    @Body(ValidationPipe) createSellerReviewDto: CreateSellerReviewDto,
  ) {
    return this.sellerReviewService.create(createSellerReviewDto, user._id);
  }

  @Get()
  @Roles(Rol.ADMIN, Rol.VENDEDOR)
  @ApiOperation({ summary: 'Get all reviews (Admin, Vendedor)' })
  @ApiResponse({ status: 200, description: 'Return all reviews' })
  findAll() {
    return this.sellerReviewService.findAll();
  }

  @Get('vendedor/:id')
  @Roles(Rol.ADMIN, Rol.VENDEDOR, Rol.CLIENTE)
  @ApiOperation({ summary: 'Get all reviews for a specific seller' })
  @ApiParam({ name: 'id', description: 'Seller ID' })
  @ApiResponse({ status: 200, description: 'Return reviews for the specified seller' })
  @ApiResponse({ status: 404, description: 'Seller not found' })
  findByVendedor(@Param('id') vendedorId: string) {
    return this.sellerReviewService.findByVendedor(vendedorId);
  }
}
