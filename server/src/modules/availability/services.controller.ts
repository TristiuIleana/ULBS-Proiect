import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('api/services')
export class ServicesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getCatalog() {
    const [services, specialists] = await Promise.all([
      this.prisma.service.findMany({
        where: { isActive: true },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
        select: {
          id: true, name: true, description: true, category: true,
          priceRon: true, totalDurationMinutes: true, isSplit: true,
          stages: {
            orderBy: { stageOrder: 'asc' },
            select: { stageOrder: true, name: true, durationMinutes: true, isBusy: true },
          },
        },
      }),
      this.prisma.user.findMany({
        where: { role: { in: ['ADMIN', 'SPECIALIST'] }, specialistCategory: { not: null } },
        orderBy: [{ firstName: 'asc' }, { id: 'asc' }],
        select: { id: true, firstName: true, specialistCategory: true },
      }),
    ]);
    return {
      services,
      specialists: specialists.map(({ id, firstName, specialistCategory }) => ({
        id, firstName, category: specialistCategory,
      })),
    };
  }
}
