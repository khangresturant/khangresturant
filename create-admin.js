/**
 * One-off admin bootstrap. Uses env only — never hardcode keys.
 * Usage: node create-admin.js
 * Requires: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY (or service role)
 */
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or ANON key) in the environment.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createAdmin() {
  const email = process.env.ADMIN_EMAIL || 'superadmin@hisabx.com';
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    console.error('Set ADMIN_PASSWORD in the environment.');
    process.exit(1);
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    console.error('Error creating admin:', error.message);
  } else {
    console.log('Admin user created:', data.user?.id, email);
  }
}

createAdmin();
