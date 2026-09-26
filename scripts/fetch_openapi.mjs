process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import fetch from 'node-fetch';

const supabaseUrl = 'https://phhrulzeaomqsvrregpc.supabase.co';
const supabaseAnonKey = 'sb_publishable_8_P6N71OloWQOjDU8vQcCw_HG4Yl71Y';

async function fetchSchema() {
  const res = await fetch(`${supabaseUrl}/rest/v1/`, {
    headers: {
      'apikey': supabaseAnonKey,
      'Authorization': `Bearer ${supabaseAnonKey}`
    }
  });

  if (!res.ok) {
    console.error('Failed to fetch OpenAPI spec:', res.status, res.statusText);
    return;
  }

  const spec = await res.json();
  const tables = {};

  if (spec.definitions) {
    for (const [tableName, def] of Object.entries(spec.definitions)) {
      tables[tableName] = Object.keys(def.properties || {});
    }
  }

  console.log(`Found ${Object.keys(tables).length} tables in PostgREST OpenAPI spec:`);
  for (const [table, cols] of Object.entries(tables).sort()) {
    console.log(`\nTable [${table}] (${cols.length} columns):`);
    console.log(cols.join(', '));
  }

  // Save to JSON for analysis
  import('fs').then(fs => {
    fs.writeFileSync('scripts/db_schema_actual.json', JSON.stringify(tables, null, 2));
    console.log('\nWrote full schema to scripts/db_schema_actual.json');
  });
}

fetchSchema();
