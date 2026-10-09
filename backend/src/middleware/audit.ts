import { prisma } from '../prisma.js';
import { redactSensitiveObject } from '../utils/masking.js';

export interface AuditLogParams {
  actorId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string;
}

export async function recordAuditEvent(params: AuditLogParams) {
  try {
    const sanitizedOld = params.oldValues ? JSON.stringify(redactSensitiveObject(params.oldValues)) : null;
    const sanitizedNew = params.newValues ? JSON.stringify(redactSensitiveObject(params.newValues)) : null;

    await prisma.auditEvent.create({
      data: {
        actorId: params.actorId || null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId || null,
        oldValuesJson: sanitizedOld,
        newValuesJson: sanitizedNew,
        ipAddress: params.ipAddress || null
      }
    });
  } catch (err) {
    console.error('Failed to record audit event:', err);
  }
}
