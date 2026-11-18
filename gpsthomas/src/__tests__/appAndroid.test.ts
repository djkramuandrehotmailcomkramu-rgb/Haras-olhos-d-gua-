import { bytesParaBase64, emAppAndroid, mensagemErro, pluginImpressao, ponteAntiga, situacaoApp } from '../nav/appAndroid';

const plugin = { imprimirPagina: async () => ({}), imprimirHtml: async () => ({}), compartilhar: async () => ({}) };

describe('casca Android', () => {
  it('reconhece o app pela marca no navegador ou pelo Capacitor', () => {
    expect(emAppAndroid({ navigator: { userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile GPSThomasApp' } })).toBe(true);
    expect(emAppAndroid({ navigator: { userAgent: 'Mozilla/5.0 Chrome/120' }, Capacitor: { isNativePlatform: () => true } })).toBe(true);
    expect(emAppAndroid({ navigator: { userAgent: 'Mozilla/5.0 Chrome/120' }, Capacitor: { isNativePlatform: () => false } })).toBe(false);
    expect(emAppAndroid({})).toBe(false);
  });
  it('acha o plugin nativo ou a ponte antiga', () => {
    expect(pluginImpressao({ Capacitor: { Plugins: { Impressao: plugin } } })).toBe(plugin);
    expect(pluginImpressao({ Capacitor: { Plugins: {} } })).toBeNull();
    expect(pluginImpressao({ Capacitor: { Plugins: { Impressao: { imprimirPagina: async () => 1 } } } })).toBeNull(); // incompleto
    expect(ponteAntiga({ AndroidPrint: { imprimirHtml: () => {} } })).not.toBeNull();
    expect(ponteAntiga({})).toBeNull();
    const s = situacaoApp({ navigator: { userAgent: 'x GPSThomasApp' }, AndroidPrint: { imprimirHtml: () => {} } });
    expect(s).toMatchObject({ app: true, plugin: false, ponteAntiga: true });
  });
  it('converte bytes em base64 (inclusive arquivos grandes) e lê mensagens de erro', () => {
    expect(bytesParaBase64(new TextEncoder().encode('%PDF-1.4'))).toBe('JVBERi0xLjQ=');
    const grande = new Uint8Array(100000).map((_, i) => i % 251);
    expect(atob(bytesParaBase64(grande))).toBe(String.fromCharCode(...grande.slice(0, 50000)) + String.fromCharCode(...grande.slice(50000)));
    expect(mensagemErro(new Error('x'))).toBe('x');
    expect(mensagemErro('texto')).toBe('texto');
    expect(mensagemErro({ message: 'do plugin' })).toBe('do plugin');
  });
});
