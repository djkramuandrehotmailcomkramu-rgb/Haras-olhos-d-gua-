import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapaInterativo } from '../../components/MapaInterativo';
import { Vidro } from '../../components/Vidro';
import { Botao } from '../../components/Botao';
import { FolhaSalvar } from '../../components/FolhaSalvar';
import { areaM2, comprimentoM, perimetroM, type Coord } from '../../geo/medidas';
import { formatarArea, formatarDistancia, type UnidadeArea } from '../../geo/unidades';
import { aceitarAmostra, type AmostraGps } from '../../geo/filtroGps';
import { useLocalizacao } from '../../geo/useLocalizacao';
import { useDados, useUi, type Comando } from '../../store/dados';
import { usePrefs } from '../../store/prefs';
import { useToast } from '../../store/toast';
import { useNumeroAnimado } from '../../hooks/animacao';
import { fonte, raio, tipo, useTema } from '../../theme';

type Modo = 'caminhar' | 'marcar' | 'linha';
const MODOS: { id: Modo; rotulo: string; icone: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'caminhar', rotulo: 'Caminhar', icone: 'walk' },
  { id: 'marcar', rotulo: 'Marcar', icone: 'pin' },
  { id: 'linha', rotulo: 'Distância', icone: 'git-commit' },
];

const CICLO: UnidadeArea[] = ['ha', 'alqPaulista', 'alqMineiro', 'alqGoiano', 'alqBaiano', 'm2'];
const mmss = (seg: number) => `${String(Math.floor(seg / 60)).padStart(2, '0')}:${String(seg % 60).padStart(2, '0')}`;

function BotaoRedondo({ icone, onPress, ativo, desabilitado }: { icone: keyof typeof Ionicons.glyphMap; onPress: () => void; ativo?: boolean; desabilitado?: boolean }) {
  const t = useTema();
  return (
    <Pressable
      disabled={desabilitado}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
      style={({ pressed }) => ({ opacity: desabilitado ? 0.35 : 1, transform: [{ scale: pressed ? 0.92 : 1 }] })}
    >
      <Vidro raioBorda={26} style={{ width: 52, height: 52, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icone} size={24} color={ativo ? t.primaria : t.texto} />
      </Vidro>
    </Pressable>
  );
}

export default function MapaTela() {
  const t = useTema();
  const ins = useSafeAreaInsets();
  const { talhoes, adicionarTalhao, adicionarMedicao } = useDados();
  const { unidadeArea, camada, definirCamada, definirUnidadeArea, onboardingVisto } = usePrefs();
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
  const setAviso = (m: string) => mostrar(m, 'info');
  const ultima = useRef<AmostraGps | null>(null);
  const primeiroFoco = useRef(true);
  const buscando = useRef(false);

  const poligono = modo !== 'linha';
  const mudar = (novos: Coord[]) => {
    setHistorico((h) => [...h.slice(-30), pontos]);
    setFuturo([]);
    setPontos(novos);
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

  const area = poligono ? areaM2(pontos) : 0;
  const perimetro = poligono ? perimetroM(pontos) : 0;
  const comprimento = comprimentoM(pontos);
  const podeSalvar = poligono ? pontos.length >= 3 : pontos.length >= 2;
  const fazendas = useMemo(() => [...new Set(talhoes.map((x) => x.fazenda))], [talhoes]);

  const marcarAqui = async () => {
    if (!gps.pos) { await gps.ligar(); setAviso('Buscando sinal de GPS… toque de novo em instantes.'); return; }
    ultima.current = { coord: gps.pos.coord, precisaoM: gps.pos.precisaoM, tempoMs: gps.pos.tempoMs };
    mudar([...pontos, gps.pos.coord]);
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

  const limpar = () => { setPontos([]); setHistorico([]); setFuturo([]); setCaminhando(false); setSegundos(0); ultima.current = null; };
  const desfazer = () => {
    if (historico.length === 0) return;
    setFuturo((f) => [...f, pontos]);
    setPontos(historico[historico.length - 1]);
    setHistorico(historico.slice(0, -1));
  };
  const refazer = () => {
    if (futuro.length === 0) return;
    setHistorico((h) => [...h, pontos]);
    setPontos(futuro[futuro.length - 1]);
    setFuturo(futuro.slice(0, -1));
  };

  const areaAnim = useNumeroAnimado(area);
  const compAnim = useNumeroAnimado(comprimento);
  const prec = gps.pos?.precisaoM ?? null;
  const corPrec = prec == null ? t.textoSuave : prec <= 10 ? t.ok : prec <= 25 ? t.atencao : t.perigo;
  const nomePrec = prec == null ? '' : prec <= 10 ? 'boa' : prec <= 25 ? 'média' : 'ruim';
  const dica = pontos.length === 0
    ? modo === 'caminhar' ? 'Toque em Iniciar e caminhe pelo contorno da área' : modo === 'marcar' ? 'Toque no mapa para marcar o primeiro ponto' : 'Toque no mapa para começar a medir a distância'
    : poligono && pontos.length < 3 ? `Marque mais ${3 - pontos.length} ${3 - pontos.length === 1 ? 'ponto' : 'pontos'} para formar a área`
    : podeSalvar && !caminhando ? 'Arraste os pontos para ajustar ou toque em Salvar' : null;
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
        onAdicionar={(c) => { if (modo !== 'caminhar') mudar([...pontos, c]); }}
        onMover={(i, c) => mudar(pontos.map((p, k) => (k === i ? c : p)))}
        onTalhao={(id) => router.push(`/talhao/${id}`)}
      />

      {/* Painel de valores */}
      <Animated.View entering={FadeInUp.duration(400)} pointerEvents="box-none" style={{ position: 'absolute', top: ins.top + 10, left: 14, right: 14, zIndex: 10 }}>
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
                <Text numberOfLines={1} style={[tipo.numeroGrande, { color: t.primaria, fontSize: tamFonte, flexShrink: 1 }]}>{pontos.length ? valorGrande : '0'}</Text>
                <Text style={{ fontFamily: fonte.semi, fontSize: 15, color: t.textoSuave }}>{pontos.length ? unid.join(' ') : unidadeArea === 'ha' ? 'ha' : ''}</Text>
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
                  {gps.ligado ? (prec != null ? `GPS ±${Math.round(prec)} m · ${nomePrec}` : 'GPS buscando…') : 'GPS desligado'}
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
      </Animated.View>

      {/* Botões laterais */}
      <Animated.View entering={FadeInUp.delay(100).duration(400)} style={{ position: 'absolute', right: 14, top: ins.top + 160, gap: 9, zIndex: 10 }}>
        <BotaoRedondo icone="locate" onPress={localizar} ativo={gps.ligado} />
        <BotaoRedondo icone={camada === 'satelite' ? 'map' : 'earth'} onPress={() => definirCamada(camada === 'satelite' ? 'mapa' : 'satelite')} />
        <BotaoRedondo icone="scan" onPress={() => { const todos = (pontos.length ? pontos : talhoes.flatMap((x) => x.contorno)); if (todos.length) setComando({ n: Date.now(), tipo: 'ajustar', pontos: todos }); }} />
        <BotaoRedondo icone="arrow-undo" onPress={desfazer} desabilitado={historico.length === 0} />
        <BotaoRedondo icone="arrow-redo" onPress={refazer} desabilitado={futuro.length === 0} />
        <BotaoRedondo icone="trash" onPress={limpar} desabilitado={pontos.length === 0} />
      </Animated.View>

      {/* Controles inferiores */}
      <Animated.View entering={FadeInUp.delay(150).duration(400)} style={{ position: 'absolute', left: 14, right: 14, bottom: Math.max(ins.bottom, 12) + 92, gap: 10, zIndex: 10 }}>
        <Vidro raioBorda={raio.pilula}>
          <View style={{ flexDirection: 'row', padding: 4 }}>
            {MODOS.map((m) => {
              const ativo = m.id === modo;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => { Haptics.selectionAsync(); setModo(m.id); if (m.id !== 'caminhar') setCaminhando(false); }}
                  style={{ flex: 1, height: 40, borderRadius: raio.pilula, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: ativo ? t.primaria : 'transparent' }}
                >
                  <Ionicons name={m.icone} size={17} color={ativo ? t.sobrePrimaria : t.textoSuave} />
                  <Text style={{ fontFamily: fonte.semi, fontSize: 14, color: ativo ? t.sobrePrimaria : t.textoSuave }}>{m.rotulo}</Text>
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
              icone={<Ionicons name={caminhando ? 'pause' : 'play'} size={20} color={caminhando ? '#fff' : t.sobrePrimaria} />}
              onPress={alternarCaminhada}
              style={{ flex: 1 }}
            />
          ) : (
            <Botao titulo="Ponto aqui" tamanho="g" variante="suave" icone={<Ionicons name="navigate" size={19} color={t.primaria} />} onPress={marcarAqui} style={{ flex: 1 }} />
          )}
          <Botao titulo="Salvar" tamanho="g" desabilitado={!podeSalvar} icone={<Ionicons name="checkmark" size={21} color={t.sobrePrimaria} />} onPress={() => { setCaminhando(false); setSalvando(true); }} style={{ flex: 1 }} />
        </View>
      </Animated.View>

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
