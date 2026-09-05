import { defineConfig } from 'vitest/config';

// Tüm iş saatleri (08:00 liste, 17:00 eskalasyon) yerel saate göre yorumlanır.
// Testler makineden bağımsız aynı sonucu versin diye saat dilimini sabitliyoruz.
process.env.TZ ??= 'Europe/Istanbul';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    env: {
      TZ: process.env.TZ,
      // Zincir testi gerçek bir PostgreSQL ister. TEST_DATABASE_URL verilmezse
      // o dosya atlanır; çekirdek testler veritabanına hiç dokunmaz.
      ...(process.env.TEST_DATABASE_URL
        ? { DATABASE_URL: process.env.TEST_DATABASE_URL, TEST_DATABASE_URL: process.env.TEST_DATABASE_URL }
        : {}),
      ISLER_ACIK: '0',
      MIKRO_ADAPTER: 'seed',
      OTURUM_SIRRI: 'test-ortami-icin-sabit-sir-degeri',
    },
    // Uçtan uca testler gerçek bir PostgreSQL ister; TEST_DATABASE_URL yoksa atlanır.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    sequence: { concurrent: false },
    fileParallelism: false,
  },
});
