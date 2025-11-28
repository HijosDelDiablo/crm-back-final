import { Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { type ValidatedUser } from '../user/schemas/user.schema';
import { FavoritesUserService } from './favorites-user.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Rol } from '../auth/enums/rol.enum';
import { Roles } from '../auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.ADMIN, Rol.CLIENTE, Rol.VENDEDOR)
@ApiTags('Favorites')
@ApiBearerAuth()
@Controller('favorites-user')
export class FavoritesUserController {
    constructor(private readonly favoritesUserService: FavoritesUserService) {}


  @Post('add/:productId')
  @ApiOperation({ summary: 'Add product to favorites' })
  @ApiParam({ name: 'productId', description: 'Product ID' })
async addToFavorites(
  @Param('productId') productId: string,
  @GetUser() user: any
) {
  return this.favoritesUserService.addToFavorites(user._id, productId);
}

@Delete('remove/:productId')
  @ApiOperation({ summary: 'Remove product from favorites' })
  @ApiParam({ name: 'productId', description: 'Product ID' })
async removeFavorite(
  @Param('productId') productId: string,
  @GetUser() user: any
) {
  return this.favoritesUserService.removeFavorite(user._id, productId);
}

@Get()
  @ApiOperation({ summary: 'Get all favorites' })
  @ApiResponse({ status: 200, description: 'Return all favorites' })
async getFavorites(@GetUser() user: any) {
  return this.favoritesUserService.getFavorites(user._id);
}


}