export default function handler(req, res) {
  const envKeys = Object.keys(process.env).filter(k => 
    k.includes('SUPABASE') || k.includes('POSTGRES') || k.includes('BLOB')
  );

  return res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    availableEnvKeys: envKeys,
    hasSupabaseUrl: Boolean(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL),
    hasPostgresUrl: Boolean(process.env.POSTGRES_URL),
    hasBlobStore: Boolean(process.env.BLOB_STORE_ID)
  });
}
