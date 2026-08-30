const fs = require('fs');
const file = 'src/components/OfficialTaxExemptionDoc.tsx';
let data = fs.readFileSync(file, 'utf8');

// Ensure supabase is imported
if (!data.includes("import { supabase } from '../lib/supabase';")) {
  data = data.replace(
    /import React, \{[^\}]+\} from 'react';\n/,
    "import React, { useState, useEffect, useRef } from 'react';\nimport { supabase } from '../lib/supabase';\n"
  );
}

const regex = /let masterMap: Record<string, \{ x: number; y: number; fontSize: number; pitch\?: number \}> = \{\};\n        try \{\n          const saved = localStorage\.getItem\('taxDocMasterFields'\);\n          if \(saved\) \{\n            const parsed = JSON\.parse\(saved\);\n            parsed\.forEach\(\(f: any\) => \{\n              masterMap\[f\.id\] = \{ x: f\.x, y: f\.y, fontSize: f\.fontSize, pitch: f\.pitch \};\n            \}\);\n          \}\n        \} catch \(_\) \{\}/;

const replacement = `let masterMap: Record<string, { x: number; y: number; fontSize: number; pitch?: number }> = {};
        try {
          const { data: sysSettings } = await supabase.from('system_settings').select('tax_doc_coordinates').limit(1).single();
          let parsed: any[] | null = sysSettings?.tax_doc_coordinates || null;
          
          if (!parsed) {
            const saved = localStorage.getItem('taxDocMasterFields');
            if (saved) parsed = JSON.parse(saved);
          }

          if (parsed && Array.isArray(parsed)) {
            parsed.forEach((f: any) => {
              masterMap[f.id] = { x: f.x, y: f.y, fontSize: f.fontSize, pitch: f.pitch };
            });
          }
        } catch (_) {}`;

data = data.replace(regex, replacement);
fs.writeFileSync(file, data);
