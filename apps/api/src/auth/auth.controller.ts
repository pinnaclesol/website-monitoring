import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import type { AuthUser } from '@uptime/auth';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { ValidateUserDto } from './dto/validate-user.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // The only unauthenticated apps/api route — everything else requires the
  // internal API key header shared with apps/web.
  @Public()
  @Post('validate')
  @HttpCode(HttpStatus.OK)
  validate(@Body() dto: ValidateUserDto): Promise<AuthUser> {
    return this.authService.validate(dto);
  }
}
