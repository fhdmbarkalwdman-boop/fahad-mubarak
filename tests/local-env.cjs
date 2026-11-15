// Resolves Supabase connection values for tests: environment variables first,
// otherwise read from the running local stack (`supabase status -o env`).
// No keys are stored in the repository.
const { execFileSync } = require('node:child_process');

function fromStatus() {
  try {
    const out = execFileSync('supabase', ['status', '-o', 'env'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const vars = {};
    for (const line of out.split('\n')) {
      const m = line.match(/^([A-Z_]+)="?(.*?)"?$/);
      if (m) vars[m[1]] = m[2];
    }
    return vars;
  } catch {
    return {};
  }
}

let cached;
module.exports = function localEnv() {
  if (cached) return cached;
  const s = process.env.SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_KEY ? {} : fromStatus();
  cached = {
    url: process.env.SUPABASE_URL || s.API_URL || 'http://127.0.0.1:54321',
    anonKey: process.env.SUPABASE_ANON_KEY || s.PUBLISHABLE_KEY || s.ANON_KEY,
    serviceKey: process.env.SUPABASE_SERVICE_KEY || s.SECRET_KEY || s.SERVICE_ROLE_KEY,
    dbUrl: process.env.DB_URL || s.DB_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  };
  if (!cached.anonKey || !cached.serviceKey) {
    throw new Error('Set SUPABASE_ANON_KEY and SUPABASE_SERVICE_KEY, or run `supabase start` first.');
  }
  return cached;
};
