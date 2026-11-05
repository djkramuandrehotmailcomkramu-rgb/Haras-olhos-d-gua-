import webpush from 'web-push';
import { addDias, calcularFator, estatisticasErro, hojeLocal, horasPrevistas, ParPrevMedido, partesLocais, somaMm } from '../shared/calc';
import { LIMITES_PADRAO, MODELOS } from '../shared/tipos';
import type { ErroModelo, Fazenda } from '../shared/tipos';
import { db, erro, Req, Res } from './_db';
import { buscarForecast, buscarMeteo } from './_om';
import { calcularHindcast } from './_hind';

const HORIZONTES = [0, 1, 3, 7];

async function tarefaFazenda(f: Fazenda & { lat: number; lon: number }) {
  const hoje = hojeLocal(f.fuso);
  const out: Record<string, unknown> = { fazenda: f.id, hoje };

  // 1) guarda a rodada de hoje (previsão de cada modelo por dia-alvo)
  const fc = await buscarForecast(f.lat, f.lon, f.fuso, 0, 16);
  const rodada = `${hoje}T12:00:00Z`;
  const linhas: any[] = [];
  const dias = fc.daily.time as number[];
  dias.forEach((ts, i) => {
    const alvoLocal = partesLocais(ts + 3600, f.fuso).dia;
    for (const m of MODELOS) {
      const mm = (fc.daily[`precipitation_sum_${m}`] as (number | null)[] | undefined)?.[i];
      if (mm == null) continue;
      const p = (fc.daily[`precipitation_probability_max_${m}`] as (number | null)[] | undefined)?.[i];
      linhas.push({ fazenda_id: f.id, rodada, modelo: m, alvo: alvoLocal, mm, prob: p == null ? null : Math.round(p) });
    }
  });
  if (linhas.length) await db('previsoes', { method: 'POST', upsert: 'fazenda_id,rodada,modelo,alvo', body: linhas, retorno: false });
  out.previsoes_gravadas = linhas.length;

  // 2) erro por modelo/horizonte contra a chuva medida
  const de = addDias(hoje, -120);
  const medidas = await db<{ data: string; mm: number }[]>('chuva_medida', { query: `fazenda_id=eq.${f.id}&data=gte.${de}&select=data,mm` });
  const porDia = new Map<string, number[]>();
  for (const m of medidas) porDia.set(m.data, [...(porDia.get(m.data) || []), Number(m.mm)]);
  const med = new Map([...porDia].map(([d, v]) => [d, v.reduce((a, b) => a + b, 0) / v.length]));
  const prevs = await db<{ rodada: string; modelo: string; alvo: string; mm: number }[]>('previsoes', {
    query: `fazenda_id=eq.${f.id}&alvo=gte.${de}&alvo=lte.${hoje}&select=rodada,modelo,alvo,mm&limit=20000`,
  });
  const erros: Omit<ErroModelo, 'atualizado_em' | 'fonte'>[] = [];
  for (const janela of [30, 90]) {
    const corte = addDias(hoje, -janela);
    const grupos = new Map<string, ParPrevMedido[]>();
    const paraFator: ParPrevMedido[] = [];
    const diasComMedida = new Set<string>();
    for (const p of prevs) {
      if (p.alvo < corte) continue;
      const real = med.get(p.alvo);
      if (real == null) continue;
      const h = Math.round((Date.parse(p.alvo) - Date.parse(p.rodada.slice(0, 10))) / 86400000);
      if (!HORIZONTES.includes(h)) continue;
      const k = `${p.modelo}|${h}`;
      grupos.set(k, [...(grupos.get(k) || []), { prev: Number(p.mm), med: real }]);
      if (h === 1) {
        paraFator.push({ prev: Number(p.mm), med: real });
        diasComMedida.add(p.alvo);
      }
    }
    for (const [k, pares] of grupos) {
      const [modelo, h] = k.split('|');
      const s = estatisticasErro(pares);
      erros.push({
        fazenda_id: f.id,
        modelo,
        horizonte: Number(h),
        janela,
        n_dias: s.n,
        mae: s.mae == null ? null : Math.round(s.mae * 100) / 100,
        vies: s.vies == null ? null : Math.round(s.vies * 100) / 100,
        acerto: s.acerto == null ? null : Math.round(s.acerto * 1000) / 1000,
      });
    }
    const fator = calcularFator(paraFator);
    if (fator != null)
      erros.push({ fazenda_id: f.id, modelo: '_fator', horizonte: 0, janela, n_dias: diasComMedida.size, mae: null, vies: Math.round(fator * 1000) / 1000, acerto: null });
  }
  if (erros.length) await db('erro_modelo', { method: 'POST', upsert: 'fazenda_id,modelo,horizonte,janela', body: erros.map((e) => ({ ...e, atualizado_em: new Date().toISOString() })), retorno: false });
  out.erros_atualizados = erros.length;

  // 2b) hindcast de 90 dias (peso inicial dos modelos, antes de haver pluviômetro)
  try {
    const h = await calcularHindcast(f.id, f.lat, f.lon, f.fuso);
    if (h.linhas.length) await db('erro_hindcast', { method: 'POST', upsert: 'fazenda_id,modelo,horizonte,janela', body: h.linhas, retorno: false });
    out.hindcast = { linhas: h.linhas.length, referencias: h.referencias };
  } catch (e) {
    out.hindcast_erro = (e as Error).message;
  }

  // 3) alertas push (≥ X mm em 24 h ou ≥ Y% nas próximas 6 h)
  const [lim] = await db<any[]>('limites_operacao', { query: `fazenda_id=eq.${f.id}` });
  const cfg = { ...LIMITES_PADRAO, ...(lim?.cfg || {}) };
  const meteo = await buscarMeteo(f.lat, f.lon, f.fuso, 0, 3).catch(() => null);
  const fc2 = await buscarForecast(f.lat, f.lon, f.fuso, 0, 3);
  const eRows = [
    ...(await db<ErroModelo[]>('erro_modelo', { query: `fazenda_id=eq.${f.id}` })).map((r) => ({ ...r, fonte: 'pluviometro' })),
    ...(await db<ErroModelo[]>('erro_hindcast', { query: `fazenda_id=eq.${f.id}` })).map((r) => ({ ...r, fonte: 'hindcast' })),
  ];
  const horas = horasPrevistas(fc2, meteo, f.fuso, eRows, hoje);
  const agora = Math.floor(Date.now() / 1000);
  const prox24 = horas.filter((h) => h.ts >= agora && h.ts < agora + 86400);
  const prox6 = horas.filter((h) => h.ts >= agora && h.ts < agora + 6 * 3600);
  const mm24 = somaMm(prox24);
  const probMax6 = Math.max(0, ...prox6.map((h) => h.prob ?? 0));
  const alertas: { tipo: string; titulo: string; corpo: string }[] = [];
  if (mm24 >= cfg.alerta_mm24) alertas.push({ tipo: 'mm24', titulo: `Chuva forte chegando — ${f.nome}`, corpo: `Cerca de ${mm24.toFixed(0)} mm nas próximas 24 horas. Evite pulverizar e deixe as máquinas fora de área baixa.` });
  if (probMax6 >= cfg.alerta_prob6) alertas.push({ tipo: 'prob6', titulo: `Pode chover em breve — ${f.nome}`, corpo: `${Math.round(probMax6)}% de chance de chuva nas próximas 6 horas. Termine o serviço de pulverização.` });
  out.alertas = alertas.map((a) => a.tipo);

  const pub = process.env.VAPID_PUBLIC;
  const priv = process.env.VAPID_PRIVATE;
  if (alertas.length && pub && priv) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:contato@example.com', pub, priv);
    const subs = await db<{ endpoint: string; sub: any }[]>('push_subs', { query: `fazenda_id=eq.${f.id}` });
    let enviados = 0;
    for (const a of alertas) {
      const ja = await db<any[]>('alertas_enviados', { query: `fazenda_id=eq.${f.id}&tipo=eq.${a.tipo}&dia=eq.${hoje}` });
      if (ja.length) continue; // não repete o mesmo alerta no mesmo dia
      await db('alertas_enviados', { method: 'POST', body: [{ fazenda_id: f.id, tipo: a.tipo, dia: hoje }], retorno: false });
      for (const s of subs) {
        try {
          await webpush.sendNotification(s.sub, JSON.stringify({ title: a.titulo, body: a.corpo, fazenda: f.id }));
          enviados++;
        } catch (e: any) {
          if (e?.statusCode === 404 || e?.statusCode === 410) await db('push_subs', { method: 'DELETE', query: `endpoint=eq.${encodeURIComponent(s.endpoint)}`, retorno: false });
        }
      }
    }
    out.push_enviados = enviados;
  } else if (alertas.length) out.push = 'VAPID não configurado: alerta calculado mas não enviado';
  return out;
}

export default async function handler(req: Req, res: Res) {
  try {
    const seg = process.env.CRON_SECRET;
    if (seg && req.headers.authorization !== `Bearer ${seg}`) return erro(res, 'não autorizado', 401);
    const fazendas = await db<Fazenda[]>('fazendas', { query: 'lat=not.is.null' });
    const resultado = [];
    for (const f of fazendas) {
      try {
        resultado.push(await tarefaFazenda(f as Fazenda & { lat: number; lon: number }));
      } catch (e) {
        resultado.push({ fazenda: f.id, erro: (e as Error).message });
      }
    }
    res.status(200).json({ ok: true, resultado });
  } catch (e) {
    erro(res, e);
  }
}
