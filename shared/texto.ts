import { fmtHora, fmtMm, fmtJanela } from './calc';
import type { Estado, Operacao, Semaforo, ValorDia, ValorHora } from './calc';
import type { Limites } from './tipos';

// ---------- escala de chuva (mm no dia) ----------
export interface ClasseChuva {
  id: 0 | 1 | 2 | 3 | 4 | 5;
  nome: string;
  explica: string;
  cor: string;
}
export const CLASSES: ClasseChuva[] = [
  { id: 0, nome: 'Sem chuva', explica: 'Tempo seco.', cor: '#8a97ad' },
  { id: 1, nome: 'Garoa / chuva fraca', explica: 'Molha pouco; quase não atrapalha o serviço.', cor: '#4ba8e0' },
  { id: 2, nome: 'Chuva moderada', explica: 'Molha o chão e a lavoura; atrapalha pulverização e colheita.', cor: '#2f7fd6' },
  { id: 3, nome: 'Chuva forte', explica: 'Encharca o solo; pode escorrer e atolar máquina.', cor: '#3a55cf' },
  { id: 4, nome: 'Chuva muito forte', explica: 'Risco de enxurrada e erosão; evite máquinas na área.', cor: '#7a3fc4' },
  { id: 5, nome: 'Chuva extrema', explica: 'Perigoso: enchente e estrada interditada.', cor: '#b0238f' },
];
export function classeChuva(mm: number | null | undefined): ClasseChuva {
  const v = mm ?? 0;
  const i = v < 0.2 ? 0 : v < 2 ? 1 : v < 10 ? 2 : v < 25 ? 3 : v < 50 ? 4 : 5;
  return CLASSES[i];
}

export type Icone = 'sol' | 'parcial' | 'nuvem' | 'chuva' | 'forte' | 'tempestade';

export interface Periodo {
  nome: 'Manhã' | 'Tarde' | 'Noite';
  ini: number;
  fim: number;
  mm: number;
  maxHora: number;
}
export function periodos(horas: ValorHora[]): Periodo[] {
  const defs: [Periodo['nome'], number, number][] = [['Manhã', 6, 12], ['Tarde', 12, 18], ['Noite', 18, 24]];
  return defs.map(([nome, ini, fim]) => {
    const hs = horas.filter((h) => h.hora >= ini && h.hora < fim);
    return { nome, ini, fim, mm: hs.reduce((s, h) => s + (h.mm ?? 0), 0), maxHora: Math.max(0, ...hs.map((h) => h.mm ?? 0)) };
  });
}

/** Ícone do dia: chuva manda; sem chuva, depende das nuvens. */
export function iconeDia(mm: number | null, nuvemMedia: number | null, rajadaMax: number | null = null): Icone {
  const v = mm ?? 0;
  if (v >= 25 || (v >= 5 && (rajadaMax ?? 0) >= 60)) return 'tempestade';
  if (v >= 10) return 'forte';
  if (v >= 0.5) return 'chuva';
  if (nuvemMedia == null) return v >= 0.2 ? 'chuva' : 'parcial';
  return nuvemMedia < 25 ? 'sol' : nuvemMedia < 65 ? 'parcial' : 'nuvem';
}

// ---------- horário da chuva em palavras ----------
export function quandoChove(horas: ValorHora[], apartirDe = 0): string | null {
  const ch = horas.filter((h) => h.hora >= apartirDe && (h.mm ?? 0) >= 0.2);
  if (!ch.length) return null;
  const ini = ch[0].hora;
  const fim = ch[ch.length - 1].hora + 1;
  if (fim - ini <= 4) return `entre ${fmtHora(ini)} e ${fmtHora(fim)}`;
  const p = periodos(ch);
  const ativos = p.filter((x) => x.mm >= 0.5);
  if (ativos.length >= 3) return 'o dia todo';
  if (ativos.length === 1) return ativos[0].nome === 'Manhã' ? 'de manhã' : ativos[0].nome === 'Tarde' ? 'à tarde' : 'à noite';
  return `de ${fmtHora(ini)} até ${fmtHora(fim)}`;
}

export interface ResumoDia {
  titulo: string;
  sub: string;
  icone: Icone;
  classe: ClasseChuva;
}
export function resumoDia(d: ValorDia | undefined, horas: ValorHora[], ehHoje: boolean, horaAgora: number): ResumoDia {
  const mm = d?.provavel ?? 0;
  const prob = d?.prob ?? 0;
  const nuvens = horas.map((h) => h.nuvem).filter((x): x is number => x != null);
  const nuvemMedia = nuvens.length ? nuvens.reduce((a, b) => a + b, 0) / nuvens.length : null;
  const raj = Math.max(0, ...horas.map((h) => h.rajada ?? 0));
  const classe = classeChuva(mm);
  const icone = iconeDia(mm, nuvemMedia, raj);
  const resto = ehHoje ? horas.filter((h) => h.hora >= horaAgora) : horas;
  const quando = quandoChove(resto);
  const jaPassou = ehHoje && mm >= 0.5 && !quando;
  let titulo: string;
  let sub: string;
  if (mm < 0.2 && prob < 30) {
    titulo = ehHoje ? 'Hoje não deve chover' : 'Não deve chover';
    sub = 'Tempo seco. Bom para trabalhar no campo.';
  } else if (mm < 0.5 && prob < 60) {
    titulo = 'Chance baixa de chuva';
    sub = `Pode cair uma garoa; ${prob}% de chance.`.replace(/\d+%/, `${Math.round(prob)}%`);
  } else if (jaPassou) {
    titulo = 'A chuva de hoje já passou';
    sub = `Choveu cerca de ${fmtMm(mm)} mm (${classe.nome.toLowerCase()}).`;
  } else if (prob >= 60 || mm >= 2) {
    titulo = mm >= 10 ? 'Vai chover forte' : 'Vai chover';
    sub = `${classe.nome}${quando ? ' ' + quando : ''}: cerca de ${fmtMm(mm)} mm.`;
  } else {
    titulo = 'Pode chover';
    sub = `${classe.nome}${quando ? ' ' + quando : ''}: cerca de ${fmtMm(mm)} mm (${Math.round(prob)}% de chance).`;
  }
  return { titulo, sub, icone, classe };
}

// ---------- confiança ----------
export type Confianca = 'alta' | 'media' | 'baixa';
export interface ConfiancaInfo {
  nivel: Confianca;
  nome: string;
  motivo: string;
}
export function confianca(d: ValorDia | undefined, diasAFrente: number): ConfiancaInfo {
  if (!d) return { nivel: 'baixa', nome: 'Baixa', motivo: 'Sem dados suficientes.' };
  const p = d.prob ?? 50;
  const certeza = Math.max(p, 100 - p);
  let n = certeza >= 85 ? 2 : certeza >= 65 ? 1 : 0;
  const motivos: string[] = [];
  motivos.push(certeza >= 85 ? 'quase todos os cenários concordam' : certeza >= 65 ? 'a maioria dos cenários concorda' : 'os cenários se dividem');
  if (d.nModelos < 4) {
    n -= 1;
    motivos.push('poucos modelos cobrem este dia');
  }
  if (diasAFrente > 7) {
    n -= 1;
    motivos.push('previsão distante (mais incerta)');
  }
  const nivel: Confianca = n >= 2 ? 'alta' : n === 1 ? 'media' : 'baixa';
  return { nivel, nome: nivel === 'alta' ? 'Alta' : nivel === 'media' ? 'Média' : 'Baixa', motivo: motivos.join('; ') + '.' };
}

// ---------- operação: palavra, frase e causa ----------
export const NOME_OP: Record<Operacao, string> = { pulv: 'Pulverização', plantio: 'Plantio', colheita: 'Colheita' };

export function causaPrincipal(op: Operacao, horas: ValorHora[], lim: Limites): string {
  const oper = horas.filter((h) => h.hora >= 6 && h.hora < 20);
  const c: Record<string, number> = {};
  const add = (k: string) => (c[k] = (c[k] || 0) + 1);
  for (const h of oper) {
    if (op === 'pulv') {
      if ((h.mm ?? 0) > lim.pulv_chuva_max) add('Chuva');
      else if (h.vento != null && h.vento > lim.pulv_vento_max) add('Vento forte');
      else if (h.temp != null && h.temp > lim.pulv_temp_max) add('Muito quente');
      else if (h.ur != null && h.ur < lim.pulv_ur_min) add('Ar seco');
    } else if (op === 'plantio') {
      if ((h.mm ?? 0) > 2) add('Chuva forte');
    } else {
      if ((h.mm ?? 0) > lim.colheita_chuva_max) add('Chuva');
      else if (h.ur != null && h.ur > lim.colheita_ur_max) add('Ar úmido');
    }
  }
  const top = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : 'Condições ruins';
}

export interface FraseTrabalho {
  palavra: 'PODE' | 'CUIDADO' | 'NÃO' | 'SEM DADOS';
  frase: string;
}
export function fraseTrabalho(op: Operacao, s: Semaforo, horas: ValorHora[], lim: Limites): FraseTrabalho {
  const estado: Estado = s.estado;
  if (estado === 'sem-dados') return { palavra: 'SEM DADOS', frase: 'Não há mais horas de trabalho hoje.' };
  if (estado === 'verde') return { palavra: 'PODE', frase: `Melhor horário: ${fmtJanela(s.janela).replace('–', ' às ')}` };
  if (estado === 'amarelo') return { palavra: 'CUIDADO', frase: `Só ${fmtJanela(s.janela).replace('–', ' às ')} (pouco tempo)` };
  if (op === 'plantio' && /encharcado/i.test(s.motivo)) return { palavra: 'NÃO', frase: 'Solo encharcado pelas chuvas dos últimos dias' };
  return { palavra: 'NÃO', frase: causaPrincipal(op, horas, lim) + ' o dia todo' };
}

export const REGRA_OP = (op: Operacao, lim: Limites): string =>
  op === 'pulv'
    ? `Para pulverizar: sem chuva por pelo menos 3 horas, vento até ${lim.pulv_vento_max} km/h, temperatura até ${lim.pulv_temp_max} °C e umidade do ar de pelo menos ${lim.pulv_ur_min}%. Confirme sempre na bula e no receituário.`
    : op === 'plantio'
      ? `Para plantar: pouca chuva no dia (até ${lim.plantio_dia_max} mm), solo sem encharcar (até ${lim.plantio_acum_max} mm nos últimos 3 dias) e sem chuva forte na hora.`
      : `Para colher: sem chuva e umidade do ar até ${lim.colheita_ur_max}% (grão seco). Chuva e ar úmido atrasam a colheita e pioram a qualidade.`;

export function textoFalado(opts: { quando: string; resumo: ResumoDia; trabalho: { nome: string; f: FraseTrabalho }[]; conf: ConfiancaInfo }): string {
  const { quando, resumo, trabalho, conf } = opts;
  const partes = [`${quando}. ${resumo.titulo}. ${resumo.sub.replace(/mm/g, 'milímetros').replace(/°C/g, 'graus')}`];
  for (const t of trabalho) partes.push(`${t.nome}: ${t.f.palavra.toLowerCase()}. ${t.f.frase.replace(/(\d+)h/g, '$1 horas').replace(' às ', ' às ')}.`);
  partes.push(`Confiança da previsão: ${conf.nome.toLowerCase()}.`);
  return partes.join(' ');
}
