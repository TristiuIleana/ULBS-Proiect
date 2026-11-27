import type { Staff } from '../../staff-api';
import { EmployeeCalendarPage } from '../employee/EmployeeCalendarPage';

export function ReceptionCalendarPage({ staff }: { staff: Staff }) {
  return <EmployeeCalendarPage staff={staff} reception />;
}
