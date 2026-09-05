import type { Request, Response } from 'express';

import { DatabaseError } from '../errors';
import { parseBody, parseParams } from '../schemas/parse';
import {
  assignPermissionBodySchema,
  assignRoleBodySchema,
  createPermissionBodySchema,
  createRoleBodySchema,
  roleNameParamsSchema,
  userIdParamsSchema,
} from '../schemas/rbac';
import type { RbacService } from '../services/rbac.service';
import { asyncHandler } from '../utils/async-handler';
import { sendSuccess } from '../utils/response';

export class RbacController {
  constructor(private readonly rbacService: RbacService | null) {}

  listRoles = asyncHandler(async (_req: Request, res: Response) => {
    const roles = await this.service().listRoles();
    return sendSuccess(res, { roles });
  });

  createRole = asyncHandler(async (req: Request, res: Response) => {
    const body = parseBody(createRoleBodySchema, req.body);
    const role = await this.service().createRole(body);
    return sendSuccess(res, { role }, 201);
  });

  listPermissions = asyncHandler(async (_req: Request, res: Response) => {
    const permissions = await this.service().listPermissions();
    return sendSuccess(res, { permissions });
  });

  createPermission = asyncHandler(async (req: Request, res: Response) => {
    const body = parseBody(createPermissionBodySchema, req.body);
    const permission = await this.service().createPermission(body);
    return sendSuccess(res, { permission }, 201);
  });

  assignPermission = asyncHandler(async (req: Request, res: Response) => {
    const params = parseParams(roleNameParamsSchema, req.params);
    const body = parseBody(assignPermissionBodySchema, req.body);
    const assignment = await this.service().assignPermissionToRole(params.roleName, body.key);
    return sendSuccess(res, assignment);
  });

  assignRole = asyncHandler(async (req: Request, res: Response) => {
    const params = parseParams(userIdParamsSchema, req.params);
    const body = parseBody(assignRoleBodySchema, req.body);
    const assignment = await this.service().assignRoleToUser(params.userId, body.role);
    return sendSuccess(res, assignment);
  });

  private service(): RbacService {
    if (!this.rbacService) {
      throw new DatabaseError('Database is not configured');
    }

    return this.rbacService;
  }
}
