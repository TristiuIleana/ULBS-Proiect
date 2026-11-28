import { BadRequestException, Body, ConflictException, Controller, Get, NotFoundException,
  Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ServiceCategory } from '@prisma/client';
import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength,
  Min, ValidateNested } from 'class-validator';
import { lockSpecialist } from '../appointments/appointments.service';
import { occupyingAppointment } from '../appointments/confirmation-deadline';
import { strictBody } from '../client-access/client-access.controller';
import { PrismaService } from '../prisma/prisma.service';
import { StaffAdminGuard } from './staff-access.controller';
import { staffIdentities } from './staff-identities';

class StageDraft {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsInt()
  @Min(1)
  @Max(2147483647)
  durationMinutes!: number;

  @IsBoolean()
  isBusy!: boolean;
}

class ServiceChanges {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @Matches(/^\d{1,8}(\.\d{1,2})?$/)
  priceRon?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2147483647)
  totalDurationMinutes?: number;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => StageDraft)
  stages?: StageDraft[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class NewService extends ServiceChanges {
  @IsEnum(ServiceCategory)
  category!: ServiceCategory;
}

const orderedStages = { orderBy: { stageOrder: 'asc' as const } };
const protectedShapes: Record<string, number[]> = {
  '00000000-0000-0000-0000-000000000001': [15, 20, 15, 25, 15],
  '00000000-0000-0000-0000-000000000003': [20],
};

function serviceShape(name?: string, total?: number, drafts?: StageDraft[]) {
  if (!name?.trim() || !total || !drafts?.length || drafts.some(stage => !stage?.name?.trim())) {
    throw new BadRequestException('Completează numele, durata și etapele serviciului.');
  }
  if (drafts.some((stage, index) => stage.isBusy !== (index % 2 === 0)) || drafts.length % 2 === 0) {
    throw new BadRequestException('Etapele alternează între ocupat și liber, cu prima și ultima ocupate.');
  }
  if (drafts.reduce((sum, stage) => sum + stage.durationMinutes, 0) !== total) {
    throw new BadRequestException('Suma etapelor trebuie să coincidă cu durata totală.');
  }
  return { name: name.trim(), totalDurationMinutes: total, isSplit: drafts.length > 1,
    stages: drafts.map(({ name, durationMinutes, isBusy }, index) =>
      ({ name: name.trim(), stageOrder: index + 1, durationMinutes, isBusy })) };
}

@Controller('api/staff/services')
@UseGuards(StaffAdminGuard)
export class StaffServicesController {
  constructor(private readonly db: PrismaService) {}

  @Get()
  async list() {
    return { services: await this.db.service.findMany({ include: { stages: orderedStages },
      orderBy: [{ category: 'asc' }, { name: 'asc' }, { id: 'asc' }] }) };
  }

  @Post()
  create(@Body(strictBody) input: NewService) {
    const { stages, ...shape } = serviceShape(input.name, input.totalDurationMinutes, input.stages);
    if (input.priceRon == null) throw new BadRequestException('Prețul este obligatoriu.');
    return this.db.service.create({ data: { ...shape, category: input.category, priceRon: input.priceRon,
      description: input.description?.trim() || null, isActive: input.isActive ?? true, stages: { create: stages } },
      include: { stages: orderedStages } });
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body(strictBody) input: ServiceChanges) {
    return this.db.$transaction(async tx => {
      const existing = await tx.service.findUnique({ where: { id }, select: { category: true } });
      if (!existing) throw new NotFoundException('Serviciul nu a fost găsit.');
      const specialists = await tx.user.findMany({
        where: { email: { in: staffIdentities.map(person => person.email) }, specialistCategory: existing.category },
        select: { id: true }, orderBy: { id: 'asc' },
      });
      for (const specialist of specialists) await lockSpecialist(tx, specialist.id);
      const service = await tx.service.findUniqueOrThrow({ where: { id }, include: { stages: orderedStages } });
      const { stages, ...shape } = serviceShape(input.name ?? service.name,
        input.totalDurationMinutes ?? service.totalDurationMinutes, input.stages ?? service.stages);
      const geometryChanged = stages.length !== service.stages.length || stages.some((stage, index) =>
        stage.durationMinutes !== service.stages[index]?.durationMinutes || stage.isBusy !== service.stages[index]?.isBusy);
      const required = protectedShapes[id];
      if (required && (required.length !== stages.length || required.some((minutes, index) => minutes !== stages[index].durationMinutes))) {
        throw new ConflictException('Duratele acestui serviciu sunt necesare pentru intercalarea aprobată.');
      }
      if (geometryChanged || (service.isActive && input.isActive === false)) {
        const now = Date.now();
        const [visit, offer] = await Promise.all([
          tx.appointment.findFirst({ where: { serviceId: id, endTime: { gt: new Date(now) },
            ...occupyingAppointment(now) }, select: { id: true } }),
          tx.waitlistEntry.findFirst({ where: { serviceId: id, status: 'NOTIFIED', expiresAt: { gt: new Date(now) } },
            select: { id: true } }),
        ]);
        if (visit || offer) throw new ConflictException('Serviciul are programări viitoare sau oferte Waitlist active.');
      }
      if (input.stages) await tx.serviceStage.deleteMany({ where: { serviceId: id } });
      return tx.service.update({ where: { id }, data: { ...shape,
        priceRon: input.priceRon ?? undefined, isActive: input.isActive ?? undefined,
        description: input.description === undefined ? undefined : input.description?.trim() || null,
        stages: input.stages ? { create: stages } : undefined,
      }, include: { stages: orderedStages } });
    });
  }
}
