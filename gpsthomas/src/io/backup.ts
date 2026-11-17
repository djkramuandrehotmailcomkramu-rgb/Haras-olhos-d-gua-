import { z } from 'zod';
import { useDados } from '../store/dados';
import { usePrefs } from '../store/prefs';

const coord = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
const anel = z.array(coord);

const talhao = z.object({
  id: z.string(), nome: z.string(), fazenda: z.string(), cultura: z.string(), safra: z.string(),
  obs: z.string().optional(), contorno: anel, criadoEm: z.number(),
});
const medicao = z.object({
  id: z.string(), tipo: z.enum(['area', 'linha']), nome: z.string(), pontos: anel,
  origem: z.enum(['gps', 'mapa', 'importado']), criadoEm: z.number(),
});
const viagem = z.object({
  id: z.string(), destino: z.string(), inicioMs: z.number(), fimMs: z.number(),
  distanciaM: z.number(), vmedKmh: z.number(), vmaxKmh: z.number(),
});
const campo = z.object({
  id: z.string(), nome: z.string(), criadoEm: z.number(),
  config: z.array(z.object({
    talhaoId: z.string(), partes: z.number(), anguloGraus: z.number().nullable(), inverter: z.boolean(),
    modo: z.enum(['iguais', 'manual']).optional(), areasHa: z.array(z.number()).optional(), areaInformadaHa: z.number().nullable().optional(),
  })),
  corredorM: z.number(), espacamentoM: z.number(), variedades: z.array(z.string()), metaHa: z.number().nullable().optional(),
  partes: z.array(z.object({ talhaoId: z.string(), indice: z.number(), pedacos: z.array(anel), areaM2: z.number(), variedade: z.string() })),
  bandeiras: z.array(z.object({ id: z.string(), coord, rotulo: z.string(), colocada: z.boolean(), linha: z.number() })),
  divisas: z.array(z.object({ id: z.number(), talhaoId: z.string(), pontos: anel })),
});
const favorito = z.object({ nome: z.string(), sub: z.string(), coord });

export const esquemaBackup = z.object({
  app: z.literal('GPSThomas'),
  versaoBackup: z.number(),
  geradoEm: z.string(),
  dados: z.object({
    talhoes: z.array(talhao), medicoes: z.array(medicao), viagens: z.array(viagem).default([]), campos: z.array(campo).default([]),
  }),
  prefs: z.object({
    unidadeArea: z.enum(['ha', 'm2', 'alqPaulista', 'alqMineiro', 'alqGoiano', 'alqBaiano']).optional(),
    camada: z.enum(['satelite', 'mapa']).optional(),
    veiculo: z.enum(['carro', 'picape', 'caminhao', 'moto']).optional(),
    favoritos: z.array(favorito).optional(),
    recentes: z.array(favorito).optional(),
    vozLigada: z.boolean().optional(),
  }).default({}),
});

export type Backup = z.infer<typeof esquemaBackup>;

export function gerarBackup(agora: Date = new Date()): Backup {
  const d = useDados.getState();
  const p = usePrefs.getState();
  return {
    app: 'GPSThomas',
    versaoBackup: 1,
    geradoEm: agora.toISOString(),
    dados: { talhoes: d.talhoes, medicoes: d.medicoes, viagens: d.viagens, campos: d.campos },
    prefs: { unidadeArea: p.unidadeArea, camada: p.camada, veiculo: p.veiculo, favoritos: p.favoritos, recentes: p.recentes, vozLigada: p.vozLigada },
  };
}

export type ResultadoLeitura = { ok: true; backup: Backup } | { ok: false; erro: string };

/** Valida o texto de um backup sem alterar nada. */
export function lerBackup(texto: string): ResultadoLeitura {
  let json: unknown;
  try { json = JSON.parse(texto); } catch { return { ok: false, erro: 'O arquivo não é um backup válido (não é JSON).' }; }
  const r = esquemaBackup.safeParse(json);
  if (!r.success) {
    const e = r.error.issues[0];
    return { ok: false, erro: `Backup inválido ou de outro aplicativo (${e.path.join('.') || 'arquivo'}: ${e.message}).` };
  }
  return { ok: true, backup: r.data };
}

export const resumoBackup = (b: Backup) =>
  `${b.dados.talhoes.length} talhões, ${b.dados.medicoes.length} medições, ${b.dados.campos.length} campos de sementes`;

/** Substitui os dados do aparelho pelos do backup (já validado). */
export function aplicarBackup(b: Backup) {
  useDados.setState({ talhoes: b.dados.talhoes, medicoes: b.dados.medicoes, viagens: b.dados.viagens, campos: b.dados.campos });
  usePrefs.setState({ ...b.prefs });
}

export type ResultadoRestauracao = { ok: true; resumo: string } | { ok: false; erro: string };

/** Valida e aplica de uma vez. */
export function restaurarBackup(texto: string): ResultadoRestauracao {
  const r = lerBackup(texto);
  if (!r.ok) return r;
  aplicarBackup(r.backup);
  return { ok: true, resumo: resumoBackup(r.backup) };
}

export const nomeArquivoBackup = (d = new Date()) => `gpsthomas-backup-${d.toISOString().slice(0, 10)}.json`;
