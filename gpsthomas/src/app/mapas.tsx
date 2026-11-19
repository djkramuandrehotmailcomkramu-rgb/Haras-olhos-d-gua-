import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Pagina } from '../components/Pagina';
import { Grupo, Linha } from '../components/Lista';
import { Botao } from '../components/Botao';
import { Cartao } from '../components/Cartao';
import { Segmentos } from '../components/Segmentos';
import { useDados, useUi } from '../store/dados';
import { useToast } from '../store/toast';
import { useOnline } from '../hooks/online';
import { areaKm2, caixaAoRedor, caixaDeCoords, contarTiles, estimarMB, formatarMB, unir, type Caixa } from '../mapa/tiles';
import { armazenamento, baixarArea, blocosSalvos, listarAreas, pedirPersistencia, removerArea, suportaOffline, type AreaOffline, type Progresso } from '../mapa/offline';
import type { CamadaId } from '../mapa/camadas';
import { fonte, tipo, useTema } from '../theme';

type Origem = 'talhoes' | 'vista' | 'eu';
const MAX_TILES = 20000;
const AVISO_TILES = 8000;
const margemM = 1000;

const posicaoAtual = () =>
  new Promise<[number, number]>((ok, erro) => {
    if (!navigator.geolocation) return erro(new Error('Sem GPS neste aparelho.'));
    navigator.geolocation.getCurrentPosition((p) => ok([p.coords.longitude, p.coords.latitude]), () => erro(new Error('Não consegui pegar sua posição. Libere o GPS e tente de novo.')), { enableHighAccuracy: true, timeout: 20000, maximumAge: 15000 });
  });

export default function MapasOffline() {
  const t = useTema();
  const mostrar = useToast((s) => s.mostrar);
  const online = useOnline();
  const talhoes = useDados((s) => s.talhoes);
  const vista = useUi((s) => s.vista);
  const [origem, setOrigem] = useState<Origem>(talhoes.length ? 'talhoes' : 'vista');
  const [camada, setCamada] = useState<'Satélite' | 'Mapa'>('Satélite');
  const [qualidade, setQualidade] = useState<'Padrão' | 'Detalhado'>('Padrão');
  const [areas, setAreas] = useState<AreaOffline[]>(() => listarAreas());
  const [uso, setUso] = useState({ usado: 0, quota: 0, persistente: false });
  const [prog, setProg] = useState<Progresso | null>(null);
  const [completos, setCompletos] = useState<Record<string, string>>({});
  const cancelar = useRef<AbortController | null>(null);
  const [posEu, setPosEu] = useState<[number, number] | null>(null);

  const camadaId: CamadaId = camada === 'Satélite' ? 'satelite' : 'mapa';
  const zmin = 12, zmax = qualidade === 'Padrão' ? 17 : 18;

  const caixaTalhoes = useMemo<Caixa | null>(() => caixaDeCoords(talhoes.flatMap((x) => x.contorno), margemM), [talhoes]);
  const caixaVista = useMemo<Caixa | null>(() => (vista ? { oeste: vista.oeste, sul: vista.sul, leste: vista.leste, norte: vista.norte } : null), [vista]);
  const caixaEu = useMemo<Caixa | null>(() => (posEu ? caixaAoRedor(posEu, 2000) : null), [posEu]);
  const caixa = origem === 'talhoes' ? caixaTalhoes : origem === 'vista' ? caixaVista : caixaEu;

  const tiles = caixa ? contarTiles(caixa, zmin, zmax) * (camadaId === 'satelite' ? 2 : 1) : 0;
  const blocos = caixa ? contarTiles(caixa, zmin, zmax) : 0;
  const mb = estimarMB(camadaId, blocos);

  const atualizarUso = async () => setUso(await armazenamento());
  useEffect(() => { atualizarUso(); }, [areas]);
  useEffect(() => {
    let vivo = true;
    (async () => {
      const r: Record<string, string> = {};
      for (const a of areas) { const b = await blocosSalvos(a); r[a.id] = b.salvos >= b.total ? 'completo' : `${Math.round((b.salvos / Math.max(1, b.total)) * 100)}%`; }
      if (vivo) setCompletos(r);
    })();
    return () => { vivo = false; };
  }, [areas]);

  const escolherEu = async () => {
    setOrigem('eu');
    if (posEu) return;
    try { setPosEu(await posicaoAtual()); } catch (e: any) { mostrar(e.message, 'erro'); setOrigem(talhoes.length ? 'talhoes' : 'vista'); }
  };

  const baixar = async () => {
    if (!caixa) return;
    if (!online) { mostrar('Conecte-se à internet (de preferência Wi-Fi) para baixar o mapa.', 'info'); return; }
    if (blocos > MAX_TILES) { mostrar('Área grande demais. Escolha uma área menor ou o modo Padrão.', 'erro'); return; }
    await pedirPersistencia();
    const ctrl = new AbortController();
    cancelar.current = ctrl;
    setProg({ feitos: 0, total: tiles, bytes: 0, falhas: 0 });
    try {
      const nome = origem === 'talhoes' ? 'Meus talhões' : origem === 'vista' ? 'Vista do mapa' : 'Ao redor de mim';
      const a = await baixarArea({ nome, caixa, camada: camadaId, zmin, zmax, onProgresso: setProg, sinal: ctrl.signal });
      setAreas(listarAreas());
      mostrar(a.falhas ? `Mapa salvo, mas ${a.falhas} blocos falharam. Baixe de novo com sinal melhor.` : 'Mapa salvo! Já funciona sem internet.', a.falhas ? 'info' : 'ok');
    } catch (e: any) {
      if (e?.name === 'AbortError') mostrar('Download cancelado.', 'info');
      else mostrar(e?.message ?? 'Não foi possível baixar o mapa.', 'erro');
    } finally {
      setProg(null);
      cancelar.current = null;
    }
  };

  const remover = async (a: AreaOffline) => { await removerArea(a.id); setAreas(listarAreas()); mostrar('Mapa removido.', 'ok'); };
  const baixando = !!prog;
  const pct = prog ? Math.round((prog.feitos / Math.max(1, prog.total)) * 100) : 0;

  if (!suportaOffline()) {
    return <Pagina titulo="Mapas offline"><Cartao><Text style={[tipo.corpo, { color: t.textoSuave }]}>Este navegador não permite guardar mapas. Use o Chrome ou o app instalado.</Text></Cartao></Pagina>;
  }

  return (
    <Pagina titulo="Mapas offline" subtitulo="Baixe antes de ir para a roça: com o mapa salvo, o app funciona sem internet.">
      <Grupo>
        <Linha titulo="Conexão" valor={online ? 'Online' : 'Sem internet'} icone={online ? 'wifi' : 'cloud-offline'} corIcone={online ? '#34C759' : '#FF9F0A'} />
        <Linha titulo="Espaço usado pelos mapas" valor={uso.quota ? `${formatarMB(uso.usado / 1048576)} de ${formatarMB(uso.quota / 1048576)}` : formatarMB(uso.usado / 1048576)} icone="server" corIcone="#8E8E93" />
        <Linha titulo="Não apagar os mapas" subtitulo={uso.persistente ? 'O navegador vai guardar os mapas mesmo com pouco espaço.' : 'Toque para pedir proteção ao navegador.'} valor={uso.persistente ? 'Protegido' : 'Pedir'} icone="shield-checkmark" corIcone="#5B4FE0" onPress={uso.persistente ? undefined : async () => { const ok = await pedirPersistencia(); await atualizarUso(); mostrar(ok ? 'Mapas protegidos.' : 'O navegador não concedeu a proteção. Instalar o app ajuda.', ok ? 'ok' : 'info'); }} seta={false} />
      </Grupo>

      <Grupo titulo="O que baixar" rodape={origem === 'vista' && !vista ? 'Abra a aba Mapa, ajuste a tela para a região desejada e volte aqui.' : undefined}>
        <Linha titulo="Meus talhões" subtitulo={caixaTalhoes ? `${areaKm2(caixaTalhoes).toFixed(1).replace('.', ',')} km² com 1 km de folga` : 'Importe ou meça talhões primeiro'} icone="layers" corIcone="#5B4FE0" onPress={caixaTalhoes ? () => setOrigem('talhoes') : undefined} seta={false} desabilitado={!caixaTalhoes} direita={origem === 'talhoes' ? <Ionicons name="checkmark-circle" size={22} color={t.primaria} /> : <Ionicons name="ellipse-outline" size={22} color={t.textoSuave} />} />
        <Linha titulo="O que está na tela do mapa" subtitulo={caixaVista ? `${areaKm2(caixaVista).toFixed(1).replace('.', ',')} km²` : 'Nenhuma vista ainda'} icone="scan" corIcone="#0A84FF" onPress={caixaVista ? () => setOrigem('vista') : undefined} seta={false} desabilitado={!caixaVista} direita={origem === 'vista' ? <Ionicons name="checkmark-circle" size={22} color={t.primaria} /> : <Ionicons name="ellipse-outline" size={22} color={t.textoSuave} />} />
        <Linha titulo="Ao redor de mim" subtitulo="Raio de 2 km pela sua posição" icone="locate" corIcone="#FF9F0A" onPress={escolherEu} seta={false} direita={origem === 'eu' ? <Ionicons name="checkmark-circle" size={22} color={t.primaria} /> : <Ionicons name="ellipse-outline" size={22} color={t.textoSuave} />} />
      </Grupo>

      <View style={{ gap: 8 }}>
        <Text style={[tipo.legenda, { color: t.textoSuave, marginLeft: 16, textTransform: 'uppercase' }]}>Tipo de mapa</Text>
        <Segmentos opcoes={['Satélite', 'Mapa']} valor={camada} onChange={(v) => setCamada(v as any)} />
        <Text style={[tipo.legenda, { color: t.textoSuave, marginLeft: 16, textTransform: 'uppercase', marginTop: 6 }]}>Detalhe</Text>
        <Segmentos opcoes={['Padrão', 'Detalhado']} valor={qualidade} onChange={(v) => setQualidade(v as any)} />
        <Text style={[tipo.legenda, { color: t.textoSuave, marginHorizontal: 16 }]}>
          {qualidade === 'Padrão' ? 'Padrão: até o zoom 17, suficiente para ver talhões, divisas e caminhos.' : 'Detalhado: até o zoom 18, vê cada linha de plantio; baixa umas 4 vezes mais.'}
        </Text>
      </View>

      <Cartao style={{ gap: 10 }}>
        {baixando ? (
          <>
            <Text style={{ fontFamily: fonte.semi, fontSize: 17, color: t.texto }}>Baixando… {pct}%</Text>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: t.cartaoSuave, overflow: 'hidden' }}>
              <View style={{ width: `${pct}%`, height: 8, backgroundColor: t.primaria }} />
            </View>
            <Text style={[tipo.legenda, { color: t.textoSuave }]}>{prog!.feitos} de {prog!.total} blocos · {formatarMB(prog!.bytes / 1048576)}{prog!.falhas ? ` · ${prog!.falhas} falhas` : ''}</Text>
            <Text style={[tipo.legenda, { color: t.textoSuave }]}>Mantenha a tela ligada e o app aberto até terminar.</Text>
            <Botao titulo="Cancelar" variante="suave" onPress={() => cancelar.current?.abort()} />
          </>
        ) : (
          <>
            <Text accessibilityLabel="Resumo do download" style={{ fontFamily: fonte.semi, fontSize: 17, color: t.texto }}>
              {caixa ? `${blocos.toLocaleString('pt-BR')} blocos · cerca de ${formatarMB(mb)}` : 'Escolha o que baixar'}
            </Text>
            {blocos > AVISO_TILES && blocos <= MAX_TILES && <Text style={[tipo.legenda, { color: t.atencao }]}>Download grande: use Wi-Fi e deixe o app aberto.</Text>}
            {blocos > MAX_TILES && <Text style={[tipo.legenda, { color: t.perigo }]}>Área grande demais para baixar de uma vez. Escolha uma área menor.</Text>}
            <Botao titulo="Baixar agora" tamanho="g" desabilitado={!caixa || blocos > MAX_TILES} icone={<Ionicons name="cloud-download-outline" size={21} color={t.sobrePrimaria} />} onPress={baixar} />
          </>
        )}
      </Cartao>

      <Grupo titulo="Mapas salvos" rodape={areas.length === 0 ? undefined : 'Toque na lixeira para liberar espaço.'}>
        {areas.length === 0 ? (
          <Linha titulo="Nenhum mapa salvo ainda" subtitulo="Baixe um acima para usar sem internet." icone="map-outline" corIcone="#8E8E93" />
        ) : (
          areas.map((a) => (
            <Linha
              key={a.id}
              titulo={`${a.nome} · ${a.camada === 'satelite' ? 'satélite' : 'mapa'}`}
              subtitulo={`zoom ${a.zmin}–${a.zmax} · ${formatarMB(a.bytes / 1048576)} · ${new Date(a.criadoEm).toLocaleDateString('pt-BR')} · ${completos[a.id] ?? '…'}`}
              icone="map"
              corIcone={a.falhas ? '#FF9F0A' : '#5B4FE0'}
              seta={false}
              direita={
                <Pressable onPress={() => remover(a)} accessibilityRole="button" accessibilityLabel={`Remover ${a.nome}`} hitSlop={8} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="trash-outline" size={22} color={t.perigo} />
                </Pressable>
              }
            />
          ))
        )}
      </Grupo>

      <Text style={[tipo.legenda, { color: t.textoSuave, marginHorizontal: 16 }]}>
        As imagens vêm de serviços públicos gratuitos (Esri e OpenStreetMap) e ficam só neste aparelho. Baixe áreas do tamanho da sua fazenda e use com moderação; para uso pesado, o ideal é um servidor de mapas próprio.
      </Text>
    </Pagina>
  );
}
