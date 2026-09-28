import { Controller, Get } from '@nestjs/common';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { RolesService } from './roles.service';

/** The fixed permission catalog — the Roles page's checkbox grid is built from this, not hardcoded, so a newly seeded permission shows up automatically. */
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermission('roles:view')
  findAll() {
    return this.rolesService.findAllPermissions();
  }
}
