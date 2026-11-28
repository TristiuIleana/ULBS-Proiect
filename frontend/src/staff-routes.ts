export const staffRoutes = {
  '/staff/agenda': 'Agenda mea',
  '/staff/receptie': 'Recepție',
  '/staff/servicii': 'Servicii',
  '/staff/rapoarte': 'Rapoarte',
} as const;

export type StaffRoute = keyof typeof staffRoutes;

export function isStaffRoute(path?: string): path is StaffRoute {
  return Boolean(path && Object.hasOwn(staffRoutes, path));
}
