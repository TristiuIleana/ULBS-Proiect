import { PrismaClient, ServiceCategory } from '@prisma/client';
import { lockEmail } from '../src/modules/client-access/client-records';
import { hashPassword, passwordMatches } from '../src/modules/client-access/password';
import { staffIdentities } from '../src/modules/staff-access/staff-identities';

const prisma = new PrismaClient();

export async function seed() {
  console.log('Seeding Beauty Studio database...');

  const configured = staffIdentities.map(({ passwordVariable, ...identity }) => {
    const password = process.env[passwordVariable];
    if (!password || password.length < 12 || password.length > 128) {
      throw new Error(`${passwordVariable} must contain 12 to 128 characters.`);
    }
    return { ...identity, password };
  });
  const [ioana, ana] = await prisma.$transaction(async tx => {
    const specialists = [];
    for (const { legacyEmail, email, role, specialistCategory, firstName, lastName, password } of configured) {
      await lockEmail(tx, email);
      await lockEmail(tx, legacyEmail);
      const matches = await tx.user.findMany({ where: {
        email: { in: [email, legacyEmail], mode: 'insensitive' },
      } });
      const existing = matches[0];
      if (matches.length > 1 || (existing &&
          (existing.role !== role || existing.specialistCategory !== specialistCategory))) {
        throw new Error('Staff identity collision. Resolve the conflicting account before running seed.');
      }
      if (!existing) {
        specialists.push(await tx.user.create({ data: {
          email, role, specialistCategory, firstName, lastName, phone: '0756062883',
          passwordHash: await hashPassword(password),
        } }));
        continue;
      }
      const changed = !await passwordMatches(password, existing.passwordHash);
      if (changed || existing.email !== email) {
        await tx.staffSession.deleteMany({ where: { userId: existing.id } });
      }
      await tx.clientSession.deleteMany({ where: { userId: existing.id } });
      specialists.push(await tx.user.update({ where: { id: existing.id }, data: {
        email, ...(changed ? { passwordHash: await hashPassword(password) } : {}),
      } }));
    }
    return specialists;
  });

  console.log('Seeded specialist categories.');

  // 2. Schedules
  // Ioana: Monday-Saturday 09:00-19:00, Sunday closed (is_working: false)
  for (let day = 0; day <= 6; day++) {
    const isSunday = day === 0;
    await prisma.specialistSchedule.upsert({
      where: {
        specialistId_dayOfWeek: {
          specialistId: ioana.id,
          dayOfWeek: day,
        },
      },
      update: {},
      create: {
        specialistId: ioana.id,
        dayOfWeek: day,
        startTime: '09:00',
        endTime: '19:00',
        isWorking: !isSunday,
      },
    });
  }

  // Ana: Monday-Sunday 09:00-19:00 (Every day including Sunday open)
  for (let day = 0; day <= 6; day++) {
    await prisma.specialistSchedule.upsert({
      where: {
        specialistId_dayOfWeek: {
          specialistId: ana.id,
          dayOfWeek: day,
        },
      },
      update: {},
      create: {
        specialistId: ana.id,
        dayOfWeek: day,
        startTime: '09:00',
        endTime: '19:00',
        isWorking: true,
      },
    });
  }
  console.log('Seeded weekly schedules for Ioana and Ana.');

  // 3. Services & Stages
  // 3.1 Laminare sprâncene (Split service - 5 stages)
  const laminare = await prisma.service.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Laminare sprâncene',
      category: ServiceCategory.BROWS,
      description: 'Tratament complet de laminare sprâncene pe 5 etape distincte',
      priceRon: 180.0,
      totalDurationMinutes: 90,
      isSplit: true,
      stages: {
        create: [
          {
            stageOrder: 1,
            name: 'Pregătire & Aplicare soluția 1 (Lifting)',
            durationMinutes: 15,
            isBusy: true,
          },
          {
            stageOrder: 2,
            name: 'Pauză acționare soluția 1 (Liber)',
            durationMinutes: 20,
            isBusy: false,
          },
          {
            stageOrder: 3,
            name: 'Aplicare soluția 2 (Fixare formă)',
            durationMinutes: 15,
            isBusy: true,
          },
          {
            stageOrder: 4,
            name: 'Pauză acționare sol. 2 & vopsea (Liber)',
            durationMinutes: 25,
            isBusy: false,
          },
          {
            stageOrder: 5,
            name: 'Tratament keratină & finalizare',
            durationMinutes: 15,
            isBusy: true,
          },
        ],
      },
    },
  });

  // 3.2 Pensat cu vopsit
  const pensatVopsit = await prisma.service.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Pensat cu vopsit',
      category: ServiceCategory.BROWS,
      description: 'Stilizare formă și vopsit sprâncene',
      priceRon: 70.0,
      totalDurationMinutes: 30,
      isSplit: false,
      stages: {
        create: [
          {
            stageOrder: 1,
            name: 'Pensat și vopsit complet',
            durationMinutes: 30,
            isBusy: true,
          },
        ],
      },
    },
  });

  // 3.3 Pensat simplu (fără vopsit)
  const pensatSimplu = await prisma.service.upsert({
    where: { id: '00000000-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000003',
      name: 'Pensat simplu (fără vopsit)',
      category: ServiceCategory.BROWS,
      description: 'Curățare și definire formă sprâncene',
      priceRon: 50.0,
      totalDurationMinutes: 20,
      isSplit: false,
      stages: {
        create: [
          {
            stageOrder: 1,
            name: 'Pensat simplu',
            durationMinutes: 20,
            isBusy: true,
          },
        ],
      },
    },
  });

  // 3.4 Make-up ocazie (fără gene)
  const makeupFaraGene = await prisma.service.upsert({
    where: { id: '00000000-0000-0000-0000-000000000004' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000004',
      name: 'Make-up ocazie (fără gene)',
      category: ServiceCategory.MAKEUP,
      description: 'Machiaj profesional de seară/eveniment fără aplicare gene false',
      priceRon: 150.0,
      totalDurationMinutes: 75,
      isSplit: false,
      stages: {
        create: [
          {
            stageOrder: 1,
            name: 'Make-up ocazie fără gene',
            durationMinutes: 75,
            isBusy: true,
          },
        ],
      },
    },
  });

  // 3.5 Make-up ocazie (cu gene)
  const makeupCuGene = await prisma.service.upsert({
    where: { id: '00000000-0000-0000-0000-000000000005' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000005',
      name: 'Make-up ocazie (cu gene)',
      category: ServiceCategory.MAKEUP,
      description: 'Machiaj profesional de seară/eveniment inclusiv aplicare gene bandă sau smocuri',
      priceRon: 170.0,
      totalDurationMinutes: 90,
      isSplit: false,
      stages: {
        create: [
          {
            stageOrder: 1,
            name: 'Make-up ocazie cu gene',
            durationMinutes: 90,
            isBusy: true,
          },
        ],
      },
    },
  });

  // 3.6 Make-up mireasă
  const makeupMireasa = await prisma.service.upsert({
    where: { id: '00000000-0000-0000-0000-000000000006' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000006',
      name: 'Make-up mireasă',
      category: ServiceCategory.MAKEUP,
      description: 'Machiaj dedicat pentru mireasă, ten rezistent la transfer, fixare waterproof',
      priceRon: 220.0,
      totalDurationMinutes: 120,
      isSplit: false,
      stages: {
        create: [
          {
            stageOrder: 1,
            name: 'Make-up mireasă complet',
            durationMinutes: 120,
            isBusy: true,
          },
        ],
      },
    },
  });

  console.log('Seeded complete service catalog with split stages.');
}

if (require.main === module) {
  seed()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
