import { Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { type ValidatedUser } from '../user/schemas/user.schema';
import { FavoritesUserService } from './favorites-user.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Rol } from '../auth/enums/rol.enum';
import { Roles } from '../auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.ADMIN, Rol.CLIENTE, Rol.VENDEDOR)
@Controller('favorites-user')
export class FavoritesUserController {
    constructor(private readonly favoritesUserService: FavoritesUserService) {}


  @Post('add/:productId')
async addToFavorites(
  @Param('productId') productId: string,
  @GetUser() user: any
) {
  return this.favoritesUserService.addToFavorites(user._id, productId);
}

@Delete('remove/:productId')
async removeFavorite(
  @Param('productId') productId: string,
  @GetUser() user: any
) {
  return this.favoritesUserService.removeFavorite(user._id, productId);
}

@Get()
async getFavorites(@GetUser() user: any) {
  return this.favoritesUserService.getFavorites(user._id);
}


}