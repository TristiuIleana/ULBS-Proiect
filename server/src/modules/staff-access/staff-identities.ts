import type { Role, ServiceCategory } from '@prisma/client';

export const staffIdentities = [
  { email: 'ioana@admin.com', legacyEmail: 'ioana@beautystudio.local', firstName: 'Ioana', lastName: '',
    role: 'ADMIN', specialistCategory: 'BROWS', passwordVariable: 'IOANA_SEED_PASSWORD' },
  { email: 'ana@admin.com', legacyEmail: 'ana@beautystudio.local', firstName: 'Ana', lastName: 'Tehnician',
    role: 'SPECIALIST', specialistCategory: 'MAKEUP', passwordVariable: 'ANA_SEED_PASSWORD' },
] as const satisfies readonly { email: string; legacyEmail: string; firstName: string; lastName: string;
  role: Role; specialistCategory: ServiceCategory; passwordVariable: string }[];

export function isStaffIdentity(user: { email: string; role: Role; specialistCategory: ServiceCategory | null }) {
  return staffIdentities.some(identity => identity.email === user.email &&
    identity.role === user.role && identity.specialistCategory === user.specialistCategory);
}
