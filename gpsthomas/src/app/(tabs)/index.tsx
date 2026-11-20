import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapaInterativo } from '../../components/MapaInterativo';
import { Vidro } from '../../components/Vidro';
import { Botao } from '../../components/Botao';
import { AlcaRecolher, PilulaMostrar, Recolhivel } from '../../components/Recolhivel';
import { FolhaSalvar } from '../../components/FolhaSalvar';
import { Segmentos } from '../../components/Segmentos';
import { entrarTelaCheia, emStandalone } from '../../nav/tela';
import { areaM2, comprimentoM, perimetroM, type Coord } from '../../geo/medidas';
import { formatarArea, formatarDistancia, type UnidadeArea } from '../../geo/unidades';
import { aceitarAmostra, type AmostraGps } from '../../geo/filtroGps';
import { useLocalizacao } from '../../geo/useLocalizacao';
import { useDados, useUi, type Comando } from '../../store/dados';
import { usePrefs } from '../../store/prefs';
import { useToast } from '../../store/toast';
import { useNumeroAnimado } from '../../hooks/animacao';
import { useOnline } from '../../hooks/online';
import { useSistema } from '../../store/sistema';
import { INSTRUCAO_INSTALAR, instalarApp } from '../../nav/tela';
import { fonte, raio, tipo, useTema } from '../../theme';

type Modo = 'caminhar' | 'marcar' | 'mira' | 'linha';
const MODOS: { id: Modo; rotulo: string }[] = [
  { id: 'caminhar', rotulo: 'Caminhar' },
  { id: 'marcar', rotulo: 'Marcar' },
  { id: 'mira', rotulo: 'Mira' },
  { id: 'linha', rotulo: 'Distância' },
];

function IconeModo({ id, cor, tamanho = 17 }: { id: Modo; cor: string; tamanho?: number }) {
  if (id === 'mira') return <MaterialCommunityIcons name="crosshairs" size={tamanho + 1} color={cor} />;
  const nome = id === 'caminhar' ? 'walk' : id === 'marcar' ? 'pin' : 'git-commit';
  return <Ionicons name={nome} size={tamanho} color={cor} />;
}

const PASSOS = ['0,5 m', '1 m', '5 m'];
const FATORES = ['1×', '½×', '¼×'];
const metros = (rot: string) => (rot === '0,5 m' ? 0.5 : rot === '5 m' ? 5 : 1);
const fatorDe = (rot: string) => (rot === '½×' ? 0.5 : rot === '¼×' ? 0.25 : 1);

/** Move uma coordenada [lon, lat] por dx metros a leste e dy metros ao norte. */
function deslocar(c: Coord, dx: number, dy: number): Coord {
  const k = 111319.49;
  return [c[0] + dx / (k * Math.cos((c[1] * Math.PI) / 180)), c[1] + dy / k];
}

const CICLO: UnidadeArea[] = ['ha', 'alqPaulista', 'alqMineiro', 'alqGoiano', 'alqBaiano', 'm2'];
const mmss = (seg: number) => `${String(Math.floor(seg / 60)).padStart(2, '0')}:${String(seg % 60).padStart(2, '0')}`;

function BotaoRedondo({ icone, onPress, ativo, desabilitado, rotulo }: { icone: keyof typeof Ionicons.glyphMap; onPress: () => void; ativo?: boolean; desabilitado?: boolean; rotulo?: string }) {
  const t = useTema();
  return (
    <Pressable
      disabled={desabilitado}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
      style={({ pressed }) => ({ opacity: desabilitado ? 0.35 : 1, transform: [{ scale: pressed ? 0.92 : 1 }] })}
    >
      <Vidro raioBorda={26} style={{ width: 52, height: 52, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icone} size={24} color={ativo ? t.primaria : t.texto} />
      </Vidro>
    </Pressable>
  );
}

function SetaAjuste({ icone, rotulo, onPress }: { icone: keyof typeof Ionicons.glyphMap; rotulo: string; onPress: () => void }) {
  const t = useTema();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={rotulo} style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 14, backgroundColor: pressed ? t.primaria : t.cartaoSuave, alignItems: 'center', justifyContent: 'center' })}>
      {({ pressed }) => <Ionicons name={icone} size={22} color={pressed ? t.sobrePrimaria : t.texto} />}
    </Pressable>
  );
}

export default function MapaTela() {
  const t = useTema();
  const ins = useSafeAreaInsets();
  const { talhoes, adicionarTalhao, adicionarMedicao } = useDados();
  const { unidadeArea, camada, definirCamada, definirUnidadeArea, onboardingVisto, painelRecolhido, definirPainel } = usePrefs();
  const mostrar = useToast((x) => x.mostrar);
  const comandoExterno = useUi((s) => s.comando);
  const gps = useLocalizacao();

  const [modo, setModo] = useState<Modo>('marcar');
  const [pontos, setPontos] = useState<Coord[]>([]);
  const [historico, setHistorico] = useState<Coord[][]>([]);
  const [caminhando, setCaminhando] = useState(false);
  const [comando, setComando] = useState<Comando | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [futuro, setFuturo] = useState<Coord[][]>([]);
  const [segundos, setSegundos] = useState(0);
  const [selecionado, setSelecionado] = useState<number | null>(null);
  const [fator, setFator] = useState('1×');
  const [passo, setPasso] = useState('1 m');
  const [centro, setCentro] = useState<Coord | null>(null);
  const ultimoAjuste = useRef<{ i: number; t: number } | null>(null);
  const { width: largura } = useWindowDimensions();
  const setAviso = (m: string) => mostrar(m, 'info');
  const ultima = useRef<AmostraGps | null>(null);
  const primeiroFoco = useRef(true);
  const buscando = useRef(false);

  const poligono = modo !== 'linha';
  const mira = modo === 'mira';
  /** `juntar`: toques seguidos nas setas do mesmo ponto viram um único passo de "desfazer". */
  const mudar = (novos: Coord[], juntar?: number) => {
    const agora = Date.now();
    const seguido = juntar != null && ultimoAjuste.current?.i === juntar && agora - ultimoAjuste.current.t < 2500;
    if (juntar != null) ultimoAjuste.current = { i: juntar, t: agora }; else ultimoAjuste.current = null;
    if (!seguido) setHistorico((h) => [...h.slice(-30), pontos]);
    setFuturo([]);
    setPontos(novos);
  };
  const empurrar = (dx: number, dy: number) => {
    if (selecionado == null || !pontos[selecionado]) return;
    const m = metros(passo);
    mudar(pontos.map((p, k) => (k === selecionado ? deslocar(p, dx * m, dy * m) : p)), selecionado);
    Haptics.selectionAsync();
  };
  const removerSelecionado = () => {
    if (selecionado == null) return;
    mudar(pontos.filter((_, k) => k !== selecionado));
    setSelecionado(null);
  };

  // GPS: centraliza na primeira posição; durante a caminhada, grava os pontos
  useEffect(() => {
    if (!gps.pos) return;
    if (primeiroFoco.current && talhoes.length === 0) {
      primeiroFoco.current = false;
      setComando({ n: Date.now(), tipo: 'voar', coord: gps.pos.coord, zoom: 17 });
    }
    if (!caminhando) return;
    const a: AmostraGps = { coord: gps.pos.coord, precisaoM: gps.pos.precisaoM, tempoMs: gps.pos.tempoMs };
    if (aceitarAmostra(ultima.current, a, { precisaoMaximaM: 25, distanciaMinimaM: 3 })) {
      ultima.current = a;
      setPontos((p) => [...p, a.coord]);
    }
  }, [gps.pos]);

  useEffect(() => { if (onboardingVisto) gps.ligar(); }, [onboardingVisto]);
  useEffect(() => {
    if (!caminhando) return;
    const id = setInterval(() => setSegundos((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [caminhando]);
  useEffect(() => { if (comandoExterno) setComando(comandoExterno); }, [comandoExterno]);
  useEffect(() => { if (gps.erro) mostrar(gps.erro, 'erro'); }, [gps.erro]);

  // na mira, os valores já incluem o ponto do centro (prévia enquanto você move o mapa)
  const pontosCalc = mira && centro ? [...pontos, centro] : pontos;
  const area = poligono ? areaM2(pontosCalc) : 0;
  const perimetro = poligono ? perimetroM(pontosCalc) : 0;
  const comprimento = comprimentoM(pontosCalc);
  const podeSalvar = poligono ? pontos.length >= 3 : pontos.length >= 2;
  const fazendas = useMemo(() => [...new Set(talhoes.map((x) => x.fazenda))], [talhoes]);

  const marcarAqui = async () => {
    if (!gps.pos) { await gps.ligar(); setAviso('Buscando sinal de GPS… toque de novo em instantes.'); return; }
    ultima.current = { coord: gps.pos.coord, precisaoM: gps.pos.precisaoM, tempoMs: gps.pos.tempoMs };
    setSelecionado(null);
    mudar([...pontos, gps.pos.coord]);
  };

  const marcarNoCentro = () => {
    if (!centro) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelecionado(null);
    mudar([...pontos, centro]);
  };

  const alternarCaminhada = async () => {
    if (caminhando) { setCaminhando(false); return; }
    await gps.ligar();
    ultima.current = null;
    setCaminhando(true);
    setAviso('Caminhe pelo contorno da área. Os pontos são gravados sozinhos.');
  };

  const localizar = async () => {
    await gps.ligar();
    if (gps.pos) setComando({ n: Date.now(), tipo: 'voar', coord: gps.pos.coord, zoom: 18 });
    else { buscando.current = true; setAviso('Buscando sinal de GPS…'); }
  };
  useEffect(() => {
    // se o usuário apertou "Localizar" antes do primeiro sinal, voa assim que chegar
    if (gps.pos && buscando.current) { buscando.current = false; setComando({ n: Date.now(), tipo: 'voar', coord: gps.pos.coord, zoom: 18 }); }
  }, [gps.pos]);

  const limpar = () => { setSelecionado(null); setPontos([]); setHistorico([]); setFuturo([]); setCaminhando(false); setSegundos(0); ultima.current = null; };
  const desfazer = () => {
    if (historico.length === 0) return;
    setSelecionado(null);
    setFuturo((f) => [...f, pontos]);
    setPontos(historico[historico.length - 1]);
    setHistorico(historico.slice(0, -1));
  };
  const refazer = () => {
    if (futuro.length === 0) return;
    setSelecionado(null);
    setHistorico((h) => [...h, pontos]);
    setPontos(futuro[futuro.length - 1]);
    setFuturo(futuro.slice(0, -1));
  };

  const online = useOnline();
  const { instalado, podeInstalar } = useSistema();
  const areaAnim = useNumeroAnimado(area);
  const compAnim = useNumeroAnimado(comprimento);
  const prec = gps.pos?.precisaoM ?? null;
  const corPrec = prec == null ? t.textoSuave : prec <= 10 ? t.ok : prec <= 25 ? t.atencao : t.perigo;
  const nomePrec = prec == null ? '' : prec <= 10 ? 'boa' : prec <= 25 ? 'média' : 'ruim';
  const dica = selecionado != null
    ? 'Arraste a alça laranja ou use as setas. Toque no mapa para concluir'
    : pontos.length === 0
    ? modo === 'caminhar' ? 'Toque em Iniciar e caminhe pelo contorno da área' : modo === 'marcar' ? 'Toque no mapa para marcar o primeiro ponto' : mira ? 'Arraste o mapa até o canto e toque em Marcar no centro' : 'Toque no mapa para começar a medir a distância'
    : poligono && pontos.length < 3 ? `Marque mais ${3 - pontos.length} ${3 - pontos.length === 1 ? 'ponto' : 'pontos'} para formar a área`
    : null;
  const resumo = poligono ? `${formatarArea(area, unidadeArea)} · perímetro ${formatarDistancia(perimetro)}` : `Distância ${formatarDistancia(comprimento)}`;
  const grande = poligono ? formatarArea(areaAnim, unidadeArea) : formatarDistancia(compAnim);
  const [valorGrande, ...unid] = grande.split(' ');
  const tamFonte = valorGrande.length > 11 ? 24 : valorGrande.length > 8 ? 30 : valorGrande.length > 6 ? 36 : 40;

  return (
    <View style={{ flex: 1, backgroundColor: t.fundo }}>
      <MapaInterativo
        talhoes={talhoes.map((x) => ({ id: x.id, nome: x.nome, rotulo: formatarArea(areaM2(x.contorno), unidadeArea), contorno: x.contorno }))}
        rascunho={pontos}
        poligono={poligono}
        camada={camada}
        posicao={gps.pos ? { coord: gps.pos.coord, precisaoM: gps.pos.precisaoM } : null}
        comando={comando}
        onAdicionar={(c) => {
          if (selecionado != null) { setSelecionado(null); return; } // primeiro toque só conclui o ajuste
          if (modo === 'caminhar' || mira) return;
          mudar([...pontos, c]);
        }}
        onMover={(i, c) => mudar(pontos.map((p, k) => (k === i ? c : p)))}
        margemTopo={ins.top + 178}
        margemBase={Math.max(ins.bottom, 12) + 92 + 270}
        selecionado={selecionado}
        onSelecionar={(i) => { Haptics.selectionAsync(); setSelecionado(i); }}
        fatorAlca={fatorDe(fator)}
        mira={mira}
        onCentro={setCentro}
        fantasma={mira ? centro : null}
        onTalhao={(id) => router.push(`/talhao/${id}`)}
      />

      {/* Painel de valores */}
      {painelRecolhido && (
        <Animated.View entering={FadeInUp.duration(250)} style={{ position: 'absolute', top: ins.top + 10, left: 14, zIndex: 10 }}>
          <Pressable onPress={() => definirPainel(false)} accessibilityLabel="Mostrar painel">
            <Vidro raioBorda={raio.pilula}>
              <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 16, height: 46, alignItems: 'center' }}>
                <Text style={{ fontFamily: fonte.negrito, fontSize: 20, color: t.primaria, fontVariant: ['tabular-nums'] }}>{pontos.length ? valorGrande : '0'}</Text>
                <Text style={{ fontFamily: fonte.semi, fontSize: 13, color: t.textoSuave }}>{pontos.length ? unid.join(' ') : unidadeArea === 'ha' ? 'ha' : ''}</Text>
                <Ionicons name="chevron-down" size={15} color={t.textoSuave} />
              </View>
            </Vidro>
          </Pressable>
        </Animated.View>
      )}
      <Recolhivel recolhido={painelRecolhido} de="cima" style={{ position: 'absolute', top: ins.top + 10, left: 14, right: 14, zIndex: 10 }}>
        <Vidro>
          <View style={{ padding: 14, flexDirection: 'row', alignItems: 'flex-end', gap: 18 }}>
            <Pressable
              disabled={!poligono}
              onPress={() => { Haptics.selectionAsync(); definirUnidadeArea(CICLO[(CICLO.indexOf(unidadeArea) + 1) % CICLO.length]); }}
              style={{ flex: 1, minWidth: 0 }}
              accessibilityLabel="Trocar unidade de área"
            >
              <Text style={[tipo.legenda, { color: t.textoSuave }]}>{poligono ? 'ÁREA' : 'DISTÂNCIA'}{caminhando ? ' · GRAVANDO' : ''}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                <Text testID="valor-area" numberOfLines={1} style={[tipo.numeroGrande, { color: t.primaria, fontSize: tamFonte, flexShrink: 1 }]}>{pontosCalc.length ? valorGrande : '0'}</Text>
                <Text style={{ fontFamily: fonte.semi, fontSize: 15, color: t.textoSuave }}>{pontosCalc.length ? unid.join(' ') : unidadeArea === 'ha' ? 'ha' : ''}</Text>
                {poligono && <Ionicons name="swap-vertical" size={14} color={t.textoSuave} />}
              </View>
            </Pressable>
            <View style={{ alignItems: 'flex-end', paddingBottom: 6, gap: 2, flexShrink: 0 }}>
              {poligono && <Text style={{ fontFamily: fonte.semi, fontSize: 15, color: t.texto }}>{formatarDistancia(perimetro)} perím.</Text>}
              {modo === 'caminhar' && segundos > 0 && <Text style={{ fontFamily: fonte.semi, fontSize: 14, color: t.texto, fontVariant: ['tabular-nums'] }}>⏱ {mmss(segundos)}</Text>}
              <Text style={[tipo.legenda, { color: t.textoSuave }]}>{pontos.length} {pontos.length === 1 ? 'ponto' : 'pontos'}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: gps.ligado ? corPrec : t.textoSuave }} />
                <Text style={[tipo.legenda, { color: gps.ligado ? corPrec : t.textoSuave }]}>
                  {gps.ligado ? (prec != null ? `GPS ±${Math.round(prec)} m · ${nomePrec}` : 'GPS buscando…') : 'GPS desligado'}{!online ? ' · offline' : ''}
                </Text>
              </View>
            </View>
          </View>
        </Vidro>
        {dica && (
          <Animated.View key={dica} entering={FadeInDown.duration(250)} pointerEvents="none" style={{ marginTop: 8, alignSelf: 'center' }}>
            <Vidro raioBorda={raio.pilula}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, paddingHorizontal: 14 }}>
                <Ionicons name="hand-left-outline" size={16} color={t.primaria} />
                <Text style={{ fontFamily: fonte.media, fontSize: 13.5, color: t.texto }}>{dica}</Text>
              </View>
            </Vidro>
          </Animated.View>
        )}
      </Recolhivel>

      {/* Botões laterais */}
      <Animated.View entering={FadeInUp.delay(100).duration(400)} style={{ position: 'absolute', right: 14, top: ins.top + 160, gap: 9, zIndex: 10 }}>
        <BotaoRedondo icone="locate" onPress={localizar} ativo={gps.ligado} />
        <BotaoRedondo icone={camada === 'satelite' ? 'map' : 'earth'} onPress={() => definirCamada(camada === 'satelite' ? 'mapa' : 'satelite')} />
        {Platform.OS === 'web' && !instalado && (
          <BotaoRedondo icone="download" rotulo="Instalar o aplicativo" onPress={async () => { const r = await instalarApp(); if (r === 'aceito') mostrar('Instalando… abra pelo ícone na tela inicial.', 'ok'); else if (r === 'indisponivel') mostrar(INSTRUCAO_INSTALAR, 'info'); }} ativo={podeInstalar} />
        )}
        <BotaoRedondo icone="cloud-download-outline" rotulo="Mapas offline" onPress={() => router.push('/mapas')} />
        <BotaoRedondo icone="scan" onPress={() => { const todos = (pontos.length ? pontos : talhoes.flatMap((x) => x.contorno)); if (todos.length) setComando({ n: Date.now(), tipo: 'ajustar', pontos: todos }); }} />
        {(pontos.length > 0 || historico.length > 0 || futuro.length > 0) && (
          <>
            <BotaoRedondo icone="arrow-undo" onPress={desfazer} desabilitado={historico.length === 0} />
            <BotaoRedondo icone="arrow-redo" onPress={refazer} desabilitado={futuro.length === 0} />
            <BotaoRedondo icone="trash" onPress={limpar} desabilitado={pontos.length === 0} />
          </>
        )}
      </Animated.View>

      {/* Ajuste fino do ponto selecionado */}
      {selecionado != null && pontos[selecionado] && (
        <Animated.View entering={FadeInUp.duration(220)} style={{ position: 'absolute', left: 14, right: 14, bottom: Math.max(ins.bottom, 12) + 92, zIndex: 12 }}>
          <Vidro>
            <View style={{ padding: 14, gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: t.atencao, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: fonte.negrito, fontSize: 13, color: '#2B1D00' }}>{selecionado + 1}</Text>
                </View>
                <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonte.semi, fontSize: 16, color: t.texto }}>Ponto {selecionado + 1}</Text>
                <Pressable onPress={removerSelecionado} accessibilityRole="button" accessibilityLabel="Remover ponto" hitSlop={6} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.cartaoSuave, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="trash-outline" size={21} color={t.perigo} />
                </Pressable>
                <Pressable onPress={() => setSelecionado(null)} accessibilityRole="button" accessibilityLabel="Concluir ajuste" hitSlop={6} style={{ height: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: t.primaria, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="checkmark" size={20} color={t.sobrePrimaria} />
                  <Text style={{ fontFamily: fonte.semi, fontSize: 14.5, color: t.sobrePrimaria }}>Pronto</Text>
                </Pressable>
              </View>

              <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
                <View style={{ alignItems: 'center', gap: 4 }}>
                  <SetaAjuste icone="arrow-up" rotulo="Mover para o norte" onPress={() => empurrar(0, 1)} />
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    <SetaAjuste icone="arrow-back" rotulo="Mover para o oeste" onPress={() => empurrar(-1, 0)} />
                    <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.atencao }} />
                    </View>
                    <SetaAjuste icone="arrow-forward" rotulo="Mover para o leste" onPress={() => empurrar(1, 0)} />
                  </View>
                  <SetaAjuste icone="arrow-down" rotulo="Mover para o sul" onPress={() => empurrar(0, -1)} />
                </View>

                <View style={{ flex: 1, gap: 8, minWidth: 0 }}>
                  <Text style={[tipo.legenda, { color: t.textoSuave }]}>CADA TOQUE NA SETA</Text>
                  <Segmentos opcoes={PASSOS} valor={passo} onChange={setPasso} />
                  <Text style={[tipo.legenda, { color: t.textoSuave }]}>ALÇA (¼× = MAIS FINA)</Text>
                  <Segmentos opcoes={FATORES} valor={fator} onChange={setFator} />
                </View>
              </View>

            </View>
          </Vidro>
        </Animated.View>
      )}

      {/* Mira: cruz fixa no centro; o mapa anda por baixo */}
      {mira && (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 6 }}>
          <View style={{ width: 76, height: 76, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ position: 'absolute', width: 2.5, height: 76, backgroundColor: '#fff', opacity: 0.9, shadowColor: '#000', shadowOpacity: 0.7, shadowRadius: 3 }} />
            <View style={{ position: 'absolute', height: 2.5, width: 76, backgroundColor: '#fff', opacity: 0.9, shadowColor: '#000', shadowOpacity: 0.7, shadowRadius: 3 }} />
            <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 3, borderColor: t.atencao, backgroundColor: 'rgba(0,0,0,0.12)' }} />
          </View>
        </View>
      )}

      {/* Controles inferiores */}
      {selecionado == null && (
      <Recolhivel recolhido={painelRecolhido} style={{ position: 'absolute', left: 14, right: 14, bottom: Math.max(ins.bottom, 12) + 92, gap: 10, zIndex: 10 }}>
        <View style={{ alignItems: 'center', marginBottom: -4 }}>
          <Vidro raioBorda={raio.pilula}><View style={{ paddingHorizontal: 22 }}><AlcaRecolher onRecolher={() => { definirPainel(true); if (!emStandalone()) entrarTelaCheia(); }} /></View></Vidro>
        </View>
        <Vidro raioBorda={raio.pilula}>
          <View style={{ flexDirection: 'row', padding: 4 }}>
            {MODOS.map((m) => {
              const ativo = m.id === modo;
              const estreito = largura < 390;
              return (
                <Pressable
                  key={m.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: ativo }}
                  onPress={() => { Haptics.selectionAsync(); setModo(m.id); setSelecionado(null); if (m.id !== 'caminhar') setCaminhando(false); }}
                  style={{ flex: 1, height: 42, borderRadius: raio.pilula, flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: ativo ? t.primaria : 'transparent' }}
                >
                  {!estreito && <IconeModo id={m.id} cor={ativo ? t.sobrePrimaria : t.textoSuave} />}
                  <Text style={{ fontFamily: fonte.semi, fontSize: estreito ? 12.5 : 13.5, color: ativo ? t.sobrePrimaria : t.textoSuave }}>{m.rotulo}</Text>
                </Pressable>
              );
            })}
          </View>
        </Vidro>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {modo === 'caminhar' ? (
            <Botao
              titulo={caminhando ? 'Pausar' : pontos.length ? 'Continuar' : 'Iniciar'}
              tamanho="g"
              variante={caminhando ? 'perigo' : 'primario'}
              icone={<Ionicons name={caminhando ? 'pause-outline' : 'play-outline'} size={20} color={caminhando ? '#fff' : t.sobrePrimaria} />}
              onPress={alternarCaminhada}
              style={{ flex: 1 }}
            />
          ) : mira ? (
            <Botao titulo="Marcar no centro" tamanho="g" desabilitado={!centro} icone={<MaterialCommunityIcons name="crosshairs-gps" size={20} color={t.sobrePrimaria} />} onPress={marcarNoCentro} style={{ flex: 1.4 }} />
          ) : (
            <Botao titulo="Ponto aqui" tamanho="g" variante="suave" icone={<Ionicons name="navigate-outline" size={19} color={t.primaria} />} onPress={marcarAqui} style={{ flex: 1 }} />
          )}
          <Botao titulo="Salvar" tamanho="g" desabilitado={!podeSalvar} icone={<Ionicons name="checkmark" size={21} color={t.sobrePrimaria} />} onPress={() => { setCaminhando(false); setSalvando(true); }} style={{ flex: 1 }} />
        </View>
      </Recolhivel>
      )}

      <PilulaMostrar visivel={painelRecolhido && selecionado == null} rotulo="Mostrar controles" onPress={() => definirPainel(false)} />

      <FolhaSalvar
        visivel={salvando}
        podeTalhao={poligono}
        resumo={resumo}
        fazendas={fazendas}
        onFechar={() => setSalvando(false)}
        onTalhao={(d) => {
          const id = adicionarTalhao({ ...d, contorno: pontos });
          setSalvando(false);
          limpar();
          router.push(`/talhao/${id}`);
        }}
        onMedicao={(nome) => {
          adicionarMedicao({ tipo: poligono ? 'area' : 'linha', nome, pontos, origem: modo === 'caminhar' ? 'gps' : 'mapa' });
          setSalvando(false);
          limpar();
          mostrar('Medição salva em Medições', 'ok');
        }}
      />
    </View>
  );
}
