import { Platform, Share } from 'react-native';

/** Baixa (web) ou compartilha (nativo) um arquivo de texto. */
const limpaNome = (n: string) => {
  const i = n.lastIndexOf('.');
  const base = (i > 0 ? n.slice(0, i) : n).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'gpsthomas';
  return base + (i > 0 ? n.slice(i) : '');
};

export async function entregarArquivo(nomeOriginal: string, conteudo: string, mime = 'application/octet-stream'): Promise<void> {
  const nome = limpaNome(nomeOriginal);
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([conteudo], { type: mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return;
  }
  await Share.share({ title: nome, message: conteudo });
}

/** Abre o seletor de arquivo (web) e devolve o texto. */
export function escolherArquivo(): Promise<{ nome: string; texto: string } | null> {
  if (Platform.OS !== 'web') return Promise.resolve(null);
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.geojson,.json,.kml,.gpx,application/json,application/vnd.google-earth.kml+xml,application/gpx+xml,text/xml';
    inp.onchange = async () => {
      const f = inp.files?.[0];
      resolve(f ? { nome: f.name, texto: await f.text() } : null);
    };
    inp.oncancel = () => resolve(null);
    inp.click();
  });
}
