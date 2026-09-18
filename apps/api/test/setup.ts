/**
 * Test ortami hazirligi.
 *
 * Testler AYRI bir veritabaninda (varsayilan: medentry_test) calisir; gelistirme
 * verisine dokunmaz. Veritabani erisilemezse ilgili testler atlanir, boylece
 * PostgreSQL olmayan ortamlarda birim testleri calismaya devam eder.
 */

process.env['NODE_ENV'] = 'test';
process.env['DATABASE_URL'] =
  process.env['TEST_DATABASE_URL'] ?? 'postgres://medentry:medentry@127.0.0.1:5432/medentry_test';
process.env['JWT_SECRET'] = 'test-ortami-icin-sabit-anahtar';
process.env['INGEST_KEY'] = 'test-ingest-anahtari';
process.env['MEDIA_PROVIDER'] = 'mock';
// Testlerde periyodik isler calismaz.
process.env['JOB_RETENTION_ENABLED'] = 'false';
