const fs = require('fs');
const file = 'src/components/TaxDocMasterInspector.tsx';
let data = fs.readFileSync(file, 'utf8');

data = data.replace(/const parsedMap = new Map\(saved\.map\(\(f\) => \[f\.id, f\]\)\);/g, "const parsedMap = new Map(saved.map((f: any) => [f.id, f]));");
data = data.replace(/const parsedMap = new Map\(parsed\.map\(\(f\) => \[f\.id, f\]\)\);/g, "const parsedMap = new Map(parsed.map((f: any) => [f.id, f]));");

fs.writeFileSync(file, data);
