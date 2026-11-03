// Importa o KML da Lagoa Formosa para o app publicado: URL=https://... node scripts/seed.mjs [arquivo.kml]
import { readFileSync } from 'fs';
const url = process.env.URL || 'https://chuva-pro-fazenda-itaguaia.vercel.app';
const kml = readFileSync(process.argv[2] || 'data/lagoa-formosa.kml', 'utf8');
const r = await fetch(`${url}/api/importar`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ id: 'lagoa-formosa', nome: 'Fazenda Lagoa Formosa', fuso: 'America/Sao_Paulo', kml, substituir: true }),
});
console.log(r.status, await r.json());
