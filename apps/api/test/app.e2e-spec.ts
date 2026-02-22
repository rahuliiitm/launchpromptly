import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';

describe('AIEcon API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.scenario.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  // ── Health ──
  describe('GET /health', () => {
    it('should return status ok', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect({ status: 'ok' });
    });
  });

  // ── Auth ──
  describe('Auth endpoints', () => {
    const testEmail = `e2e-test-${Date.now()}@example.com`;

    describe('POST /auth/register', () => {
      it('should register a new user and return JWT', async () => {
        const res = await request(app.getHttpServer())
          .post('/auth/register')
          .send({ email: testEmail })
          .expect(201);

        expect(res.body.accessToken).toBeDefined();
        expect(typeof res.body.accessToken).toBe('string');
        expect(res.body.userId).toBeDefined();
      });

      it('should return same user on duplicate registration', async () => {
        const res = await request(app.getHttpServer())
          .post('/auth/register')
          .send({ email: testEmail })
          .expect(201);

        expect(res.body.accessToken).toBeDefined();
        expect(res.body.userId).toBeDefined();
      });

      it('should reject invalid email', async () => {
        await request(app.getHttpServer())
          .post('/auth/register')
          .send({ email: 'not-an-email' })
          .expect(400);
      });

      it('should reject empty body', async () => {
        await request(app.getHttpServer())
          .post('/auth/register')
          .send({})
          .expect(400);
      });
    });

    describe('POST /auth/login', () => {
      it('should login existing user', async () => {
        const res = await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: testEmail })
          .expect(201);

        expect(res.body.accessToken).toBeDefined();
      });

      it('should return 404 for non-existent user', async () => {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: 'nonexistent@example.com' })
          .expect(404);
      });
    });
  });

  // ── Scenario ──
  describe('Scenario endpoints', () => {
    let accessToken: string;
    let scenarioId: string;
    const scenarioEmail = `e2e-scenario-${Date.now()}@example.com`;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: scenarioEmail });
      accessToken = res.body.accessToken;
    });

    describe('POST /scenario', () => {
      it('should create a scenario with financial results', async () => {
        const res = await request(app.getHttpServer())
          .post('/scenario')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            name: 'E2E Test Scenario',
            model: 'gpt-4',
            avgInputTokens: 1000,
            avgOutputTokens: 500,
            requestsPerUser: 100,
            projectedUsers: 1000,
            subscriptionPrice: 29,
          })
          .expect(201);

        scenarioId = res.body.id;

        expect(res.body.name).toBe('E2E Test Scenario');
        expect(res.body.model).toBe('gpt-4');
        expect(res.body.financialResult).toBeDefined();
        expect(res.body.financialResult.costPerRequest).toBeCloseTo(0.025, 4);
        expect(res.body.financialResult.costPerUser).toBeCloseTo(2.5, 4);
        expect(res.body.financialResult.monthlyCost).toBeCloseTo(2500, 2);
        expect(res.body.financialResult.grossMargin).toBeCloseTo(91.38, 1);
        expect(res.body.financialResult.riskLevel).toBe('Low');
      });

      it('should reject request without auth', async () => {
        await request(app.getHttpServer())
          .post('/scenario')
          .send({
            name: 'No Auth',
            model: 'gpt-4',
            avgInputTokens: 1000,
            avgOutputTokens: 500,
            requestsPerUser: 100,
            projectedUsers: 1000,
            subscriptionPrice: 29,
          })
          .expect(401);
      });

      it('should reject invalid model', async () => {
        await request(app.getHttpServer())
          .post('/scenario')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            name: 'Bad Model',
            model: 'invalid-model',
            avgInputTokens: 1000,
            avgOutputTokens: 500,
            requestsPerUser: 100,
            projectedUsers: 1000,
            subscriptionPrice: 29,
          })
          .expect(400);
      });

      it('should reject negative token counts', async () => {
        await request(app.getHttpServer())
          .post('/scenario')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            name: 'Negative Tokens',
            model: 'gpt-4',
            avgInputTokens: -100,
            avgOutputTokens: 500,
            requestsPerUser: 100,
            projectedUsers: 1000,
            subscriptionPrice: 29,
          })
          .expect(400);
      });

      it('should reject missing required fields', async () => {
        await request(app.getHttpServer())
          .post('/scenario')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ name: 'Incomplete' })
          .expect(400);
      });
    });

    describe('GET /scenario/:id', () => {
      it('should return scenario with financial results', async () => {
        const res = await request(app.getHttpServer())
          .get(`/scenario/${scenarioId}`)
          .expect(200);

        expect(res.body.id).toBe(scenarioId);
        expect(res.body.financialResult).toBeDefined();
        expect(res.body.financialResult.costPerRequest).toBeCloseTo(0.025, 4);
        expect(res.body.financialResult.riskLevel).toBe('Low');
      });

      it('should return 404 for non-existent scenario', async () => {
        await request(app.getHttpServer())
          .get('/scenario/00000000-0000-0000-0000-000000000000')
          .expect(404);
      });
    });

    describe('GET /scenario/:id/simulations', () => {
      it('should return 4 architecture simulations sorted by margin', async () => {
        const res = await request(app.getHttpServer())
          .get(`/scenario/${scenarioId}/simulations`)
          .expect(200);

        expect(res.body).toHaveLength(4);

        // Verify sorted by highest margin
        for (let i = 0; i < res.body.length - 1; i++) {
          expect(res.body[i].grossMargin).toBeGreaterThanOrEqual(
            res.body[i + 1].grossMargin,
          );
        }

        // GPT-4 Mini should be first (highest margin)
        expect(res.body[0].architectureName).toBe('GPT-4 Mini');

        // Full GPT-4 should be last (lowest margin)
        expect(res.body[3].architectureName).toBe('Full GPT-4');

        // Verify all required fields present
        for (const sim of res.body) {
          expect(sim.architectureName).toBeDefined();
          expect(sim.costPerUser).toBeDefined();
          expect(sim.monthlyCost).toBeDefined();
          expect(sim.grossMargin).toBeDefined();
          expect(sim.riskLevel).toBeDefined();
        }
      });

      it('should return 404 for non-existent scenario', async () => {
        await request(app.getHttpServer())
          .get('/scenario/00000000-0000-0000-0000-000000000000/simulations')
          .expect(404);
      });

      it('should return correct GPT-4 Mini simulation values', async () => {
        const res = await request(app.getHttpServer())
          .get(`/scenario/${scenarioId}/simulations`)
          .expect(200);

        const mini = res.body.find(
          (s: { architectureName: string }) => s.architectureName === 'GPT-4 Mini',
        );
        expect(mini).toBeDefined();
        expect(mini.costPerUser).toBeCloseTo(0.5, 4);
        expect(mini.monthlyCost).toBeCloseTo(500, 2);
        expect(mini.grossMargin).toBeCloseTo(98.28, 1);
        expect(mini.riskLevel).toBe('Low');
      });

      it('should detect high risk when margin is low', async () => {
        // Create scenario with low subscription price → high risk
        const createRes = await request(app.getHttpServer())
          .post('/scenario')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            name: 'High Risk Test',
            model: 'gpt-4',
            avgInputTokens: 1000,
            avgOutputTokens: 500,
            requestsPerUser: 100,
            projectedUsers: 1000,
            subscriptionPrice: 3,
          })
          .expect(201);

        const simRes = await request(app.getHttpServer())
          .get(`/scenario/${createRes.body.id}/simulations`)
          .expect(200);

        const gpt4 = simRes.body.find(
          (s: { architectureName: string }) => s.architectureName === 'Full GPT-4',
        );
        expect(gpt4.riskLevel).toBe('High');
      });
    });
  });
});
