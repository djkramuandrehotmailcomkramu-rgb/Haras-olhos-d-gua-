import { Platform, Share } from 'react-native';
import { kmlDeKmz } from './formatos';
import { bytesParaBase64, emAppAndroid, mensagemErro, pluginImpressao } from '../nav/appAndroid';
import { useToast } from '../store/toast';

/** Baixa (web) ou compartilha (nativo) um arquivo de texto. */
const limpaNome = (n: string) => {
  const i = n.lastIndexOf('.');
  const base = (i > 0 ? n.slice(0, i) : n).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'gpsthomas';
  return base + (i > 0 ? n.slice(i) : '');
};

/**
 * Entrega um arquivo: no navegador baixa; no app Android abre a folha de compartilhar (salvar em Arquivos, WhatsApp, e-mail...),
 * porque o WebView não trata downloads. Devolve false (com aviso na tela) se não foi possível.
 */
export async function entregarBytes(nomeOriginal: string, bytes: Uint8Array, mime = 'application/octet-stream'): Promise<boolean> {
  const nome = limpaNome(nomeOriginal);
  if (Platform.OS !== 'web') { await Share.share({ title: nome, message: new TextDecoder().decode(bytes) }); return true; }
  if (emAppAndroid()) {
    const plugin = pluginImpressao();
    if (!plugin) { useToast.getState().mostrar('Para salvar arquivos pelo app, baixe o APK novo (gpsthomas.vercel.app/GPSThomas.apk) e instale por cima.', 'erro'); return false; }
    try {
      await plugin.compartilhar({ nome, mime, base64: bytesParaBase64(bytes) });
      return true;
    } catch (e) {
      useToast.getState().mostrar(`Não foi possível compartilhar o arquivo: ${mensagemErro(e)}`, 'erro');
      return false;
    }
  }
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}

export async function entregarArquivo(nomeOriginal: string, conteudo: string, mime = 'application/octet-stream'): Promise<void> {
  if (Platform.OS !== 'web') { await Share.share({ title: limpaNome(nomeOriginal), message: conteudo }); return; }
  await entregarBytes(nomeOriginal, new TextEncoder().encode(conteudo), mime);
}

/** Abre o seletor de arquivo (web) e devolve o texto. */
export function escolherArquivo(aceitar?: string): Promise<{ nome: string; texto: string } | null> {
  if (Platform.OS !== 'web') return Promise.resolve(null);
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = aceitar ?? '.geojson,.json,.kml,.kmz,.gpx,application/json,application/vnd.google-earth.kml+xml,application/gpx+xml,text/xml';
    inp.onchange = async () => {
      const f = inp.files?.[0];
      if (!f) return resolve(null);
      if (/\.kmz$/i.test(f.name)) {
        try { resolve({ nome: f.name, texto: kmlDeKmz(new Uint8Array(await f.arrayBuffer())) }); } catch { resolve({ nome: f.name, texto: '' }); }
      } else resolve({ nome: f.name, texto: await f.text() });
    };
    inp.oncancel = () => resolve(null);
    inp.click();
  });
}
