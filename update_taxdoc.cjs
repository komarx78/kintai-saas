const fs = require('fs');
const file = 'src/components/TaxDocMasterInspector.tsx';
let data = fs.readFileSync(file, 'utf8');

const regex = /const \[fields, setFields\] = useState<FieldConfig\[\]>\(\(\) => \{[\s\S]*?return DEFAULT_TAX_FIELDS;\n  \}\);/;

const replacement = `const [fields, setFields] = useState<FieldConfig[]>(DEFAULT_TAX_FIELDS);

  useEffect(() => {
    const fetchMaster = async () => {
      try {
        const { data } = await supabase.from('system_settings').select('tax_doc_coordinates').limit(1).single();
        const saved = data?.tax_doc_coordinates;
        if (saved && Array.isArray(saved)) {
          const parsedMap = new Map(saved.map((f) => [f.id, f]));
          setFields(DEFAULT_TAX_FIELDS.map(def => {
            const custom = parsedMap.get(def.id);
            if (custom) return { ...def, x: custom.x, y: custom.y, fontSize: custom.fontSize, pitch: custom.pitch !== undefined ? custom.pitch : def.pitch };
            return def;
          }));
        } else {
          const localSaved = localStorage.getItem('taxDocMasterFields');
          if (localSaved) {
            const parsed = JSON.parse(localSaved);
            const parsedMap = new Map(parsed.map((f) => [f.id, f]));
            setFields(DEFAULT_TAX_FIELDS.map(def => {
              const custom = parsedMap.get(def.id);
              if (custom) return { ...def, x: custom.x, y: custom.y, fontSize: custom.fontSize, pitch: custom.pitch !== undefined ? custom.pitch : def.pitch };
              return def;
            }));
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchMaster();
  }, []);`;

data = data.replace(regex, replacement);

const regexSave = /const handleSaveMaster = \(\) => \{[\s\S]*?\}, 500\);\n  \};/;

const replacementSave = `const handleSaveMaster = async () => {
    setIsSaving(true);
    try {
      const { data: current } = await supabase.from('system_settings').select('id').limit(1).single();
      if (current) {
        await supabase.from('system_settings').update({ tax_doc_coordinates: fields }).eq('id', current.id);
      } else {
        await supabase.from('system_settings').insert([{ tax_doc_coordinates: fields }]);
      }
      localStorage.setItem('taxDocMasterFields', JSON.stringify(fields));
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err) {
      console.error(err);
      alert('保存に失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };`;

data = data.replace(regexSave, replacementSave);

fs.writeFileSync(file, data);
