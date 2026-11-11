import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('production'),
  PORT: z.coerce.number().int().min(1024).max(65535).default(3000),
  SUPABASE_URL: z.string().default(''),
  SUPABASE_PUBLISHABLE_KEY: z.string().default(''),
  SUPABASE_SECRET_KEY: z.string().default(''),
  PUBLIC_SITE_URL: z.string().default(''),
  CLIENT_ORIGIN: z.string().default('http://localhost:3000'),
  STORAGE_BUCKET: z.string().default('article-images'),
  PRODUCT_IMAGE_BUCKET: z.string().default('product-images'),
  DIGITAL_FILES_BUCKET: z.string().default('digital-files'),
  COMMERCE_DB_ENABLED: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  PAYMENTS_ENABLED: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  PAYTECH_API_KEY: z.string().default(''),
  PAYTECH_API_SECRET: z.string().default(''),
  PAYTECH_ENV: z.enum(['test', 'prod']).default('test'),
  PAYTECH_PAYMENT_METHODS: z.string().default(''),
});

const parsed = environmentSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
  throw new Error(`Configuration serveur invalide : ${details}`);
}

const values = parsed.data;
const hasAnySupabaseValue = Boolean(
  values.SUPABASE_URL || values.SUPABASE_PUBLISHABLE_KEY || values.SUPABASE_SECRET_KEY,
);
const supabaseConfigured = Boolean(
  values.SUPABASE_URL && values.SUPABASE_PUBLISHABLE_KEY && values.SUPABASE_SECRET_KEY,
);

export const config = {
  nodeEnv: values.NODE_ENV,
  port: values.PORT,
  supabaseUrl: values.SUPABASE_URL.replace(/\/$/, ''),
  supabasePublishableKey: values.SUPABASE_PUBLISHABLE_KEY,
  supabaseSecretKey: values.SUPABASE_SECRET_KEY,
  supabaseConfigured,
  supabasePartiallyConfigured: hasAnySupabaseValue && !supabaseConfigured,
  commerceDatabaseEnabled: values.COMMERCE_DB_ENABLED,
  demoMode: !values.COMMERCE_DB_ENABLED || !supabaseConfigured,
  publicSiteUrl: values.PUBLIC_SITE_URL.replace(/\/$/, ''),
  clientOrigin: values.CLIENT_ORIGIN.replace(/\/$/, ''),
  storageBucket: values.STORAGE_BUCKET,
  productImageBucket: values.PRODUCT_IMAGE_BUCKET,
  digitalFilesBucket: values.DIGITAL_FILES_BUCKET,
  paymentsEnabled: values.PAYMENTS_ENABLED,
  paytechApiKey: values.PAYTECH_API_KEY,
  paytechApiSecret: values.PAYTECH_API_SECRET,
  paytechEnv: values.PAYTECH_ENV,
  paytechPaymentMethods: values.PAYTECH_PAYMENT_METHODS.split(',').map((method) => method.trim()).filter(Boolean),
  paytechConfigured: Boolean(values.PAYTECH_API_KEY && values.PAYTECH_API_SECRET && values.PUBLIC_SITE_URL && values.PAYTECH_PAYMENT_METHODS.trim()),
  maxUploadBytes: 10 * 1024 * 1024,
  maxDigitalUploadBytes: 50 * 1024 * 1024,
  allowedImageTypes: new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']),
  allowedDigitalTypes: new Set(['application/pdf', 'application/zip', 'application/epub+zip', 'audio/mpeg', 'audio/mp4', 'video/mp4']),
};
