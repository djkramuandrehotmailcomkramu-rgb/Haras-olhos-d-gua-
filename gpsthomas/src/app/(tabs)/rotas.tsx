import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapaInterativo } from '../../components/MapaInterativo';
import { Vidro } from '../../components/Vidro';
import { Botao } from '../../components/Botao';
import { useLocalizacao } from '../../geo/useLocalizacao';
import { areaM2, type Coord } from '../../geo/medidas';
import { formatarArea, formatarDistancia } from '../../geo/unidades';
import { buscarLugar, type Lugar } from '../../nav/geocodificar';
import { calcularRotas, type Rota } from '../../nav/rota';
import { estadoNavegacao, formatarDuracao, fraseFalada, prepararRota, projetar } from '../../nav/progresso';
import { falar, manterTelaLigada, pararVoz } from '../../nav/voz';
import { useDados, useUi, type Comando } from '../../store/dados';
import { usePrefs } from '../../store/prefs';
import { useToast } from '../../store/toast';
import { fonte, raio, tipo, useTema } from '../../theme';

type Etapa = 'busca' | 'previa' | 'nav';

const ANGULO: Record<string, number> = { straight: 0, 'slight right': 45, right: 90, 'sharp right': 135, uturn: 180, 'sharp left': -135, left: -90, 'slight left': -45 };

function IconeManobra({ tipoPasso, mod, cor, tamanho = 44 }: { tipoPasso: string; mod?: string; cor: string; tamanho?: number }) {
  if (tipoPasso === 'arrive') return <Ionicons name="flag" size={tamanho} color={cor} />;
  if (tipoPasso.includes('roundabout') || tipoPasso.includes('rotary')) return <Ionicons name="sync" size={tamanho} color={cor} />;
  return (
    <View style={{ transform: [{ rotate: `${ANGULO[mod ?? 'straight'] ?? 0}deg` }] }}>
      <Ionicons name="arrow-up" size={tamanho} color={cor} />
    </View>
  );
}

const horaChegada = (segundos: number) => new Date(Date.now() + segundos * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export default function RotasTela() {
  const t = useTema();
  const ins = useSafeAreaInsets();
  const gps = useLocalizacao();
  const { talhoes } = useDados();
  const { unidadeArea, camada, recentes, lembrarDestino, vozLigada, definirVoz } = usePrefs();
  const mostrar = useToast((s) => s.mostrar);
  const destinoUi = useUi((s) => s.destino);

  const [etapa, setEtapa] = useState<Etapa>('busca');
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState<Lugar[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [escolhendo, setEscolhendo] = useState(false);
  const [destino, setDestino] = useState<Lugar | null>(null);
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [ativa, setAtiva] = useState(0);
  const [calculando, setCalculando] = useState(false);
  const [comando, setComando] = useState<Comando | null>(null);
  const [pendente, setPendente] = useState<Lugar | null>(null);
  const [seguir, setSeguir] = useState<Coord | null>(null);
  const [along, setAlong] = useState(0);
  const [recalculando, setRecalculando] = useState(false);

  const idxRef = useRef(0);
  const fora = useRef(0);
  const ultimoRecalculo = useRef(0);
  const falados = useRef<Set<string>>(new Set());
  const abortar = useRef<AbortController | null>(null);

  const rota = rotas[ativa] ?? null;
  const prep = useMemo(() => (rota ? prepararRota(rota) : null), [rota]);
  const estado = useMemo(() => (prep ? estadoNavegacao(prep, along) : null), [prep, along]);

  useEffect(() => { gps.ligar(); }, []);
  useEffect(() => { if (gps.erro) mostrar(gps.erro, 'erro'); }, [gps.erro]);

  // Destino vindo de outra tela (ex.: "Traçar rota até o talhão")
  useEffect(() => {
    if (!destinoUi) return;
    const l: Lugar = { nome: destinoUi.nome, sub: 'Talhão', coord: destinoUi.coord };
    setDestino(l);
    tracar(l);
  }, [destinoUi?.n]);

  // Assim que o GPS responde, continua o que ficou esperando
  useEffect(() => {
    if (pendente && gps.pos) { const l = pendente; setPendente(null); tracar(l); }
  }, [gps.pos, pendente]);

  // Busca com pequena espera (respeita o limite do serviço gratuito)
  useEffect(() => {
    const q = texto.trim();
    if (etapa !== 'busca' || q.length < 3) { setResultados([]); return; }
    const ac = new AbortController();
    const h = setTimeout(async () => {
      setBuscando(true);
      try { setResultados(await buscarLugar(q, gps.pos?.coord, ac.signal)); }
      catch (e: any) { if (e?.name !== 'AbortError') mostrar('Não foi possível buscar agora. Verifique a internet.', 'erro'); }
      finally { setBuscando(false); }
    }, 750);
    return () => { clearTimeout(h); ac.abort(); };
  }, [texto, etapa]);

  async function tracar(l: Lugar, origemForcada?: Coord) {
    const origem = origemForcada ?? gps.pos?.coord;
    if (!origem) {
      setPendente(l);
      gps.ligar();
      mostrar('Buscando sinal de GPS para saber de onde você parte…', 'info');
      return;
    }
    abortar.current?.abort();
    const ac = new AbortController();
    abortar.current = ac;
    setCalculando(true);
    setDestino(l);
    try {
      const r = await calcularRotas(origem, l.coord, ac.signal);
      setRotas(r);
      setAtiva(0);
      setEtapa('previa');
      setResultados([]);
      setComando({ n: Date.now(), tipo: 'ajustar', pontos: [origem, ...r[0].geometria] });
      lembrarDestino({ nome: l.nome, sub: l.sub, coord: l.coord });
    } catch (e: any) {
      if (e?.name !== 'AbortError') mostrar(e?.message?.includes('Nenhuma rota') ? 'Não há rota por estrada até esse ponto.' : 'Não foi possível calcular a rota. Verifique a internet.', 'erro');
    } finally {
      setCalculando(false);
    }
  }

  const iniciar = () => {
    if (!rota) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    idxRef.current = 0;
    fora.current = 0;
    falados.current = new Set();
    setAlong(0);
    setEtapa('nav');
    setSeguir(gps.pos?.coord ?? null);
    manterTelaLigada(true);
    if (vozLigada) falar(`Iniciando a rota. ${rota.passos[0]?.texto ?? ''}. Destino a ${formatarDistancia(rota.distanciaM).replace('.', ',')}.`);
  };

  const encerrar = () => {
    pararVoz();
    manterTelaLigada(false);
    setSeguir(null);
    setEtapa('busca');
    setRotas([]);
    setDestino(null);
    setTexto('');
  };

  // Laço de navegação: a cada posição do GPS
  useEffect(() => {
    if (etapa !== 'nav' || !prep || !gps.pos) return;
    setSeguir(gps.pos.coord);
    const pr = projetar(prep, gps.pos.coord, idxRef.current);
    idxRef.current = pr.idx;
    setAlong(pr.alongM);
    const est = estadoNavegacao(prep, pr.alongM);

    if (est.chegou) {
      if (vozLigada) falar('Você chegou ao seu destino.');
      mostrar('Você chegou ao destino', 'ok');
      encerrar();
      return;
    }

    // Fora da rota? Recalcula a partir de onde você está
    if (pr.desvioM > 60 && (gps.pos.precisaoM ?? 0) < 50) fora.current += 1; else fora.current = 0;
    if (fora.current >= 3 && Date.now() - ultimoRecalculo.current > 10000 && destino) {
      ultimoRecalculo.current = Date.now();
      fora.current = 0;
      setRecalculando(true);
      if (vozLigada) falar('Recalculando a rota.');
      calcularRotas(gps.pos.coord, destino.coord)
        .then((r) => { setRotas(r); setAtiva(0); idxRef.current = 0; falados.current = new Set(); setAlong(0); })
        .catch(() => mostrar('Sem internet para recalcular. Voltando à rota anterior.', 'erro'))
        .finally(() => setRecalculando(false));
      return;
    }

    // Avisos de voz antes de cada manobra
    if (vozLigada && est.proximo) {
      const chave = rota?.passos.indexOf(est.proximo) ?? -1;
      const d = est.distAteProximoM;
      const nivel = d <= 40 ? 'agora' : d <= 160 ? 'perto' : d <= 450 ? 'longe' : null;
      if (nivel && !falados.current.has(`${chave}-${nivel}`)) {
        falados.current.add(`${chave}-${nivel}`);
        falar(fraseFalada(d, est.proximo.texto));
      }
    }
  }, [gps.pos, etapa]);

  const aoTocarNoMapa = (c: Coord) => {
    if (!escolhendo) return;
    setEscolhendo(false);
    tracar({ nome: 'Ponto no mapa', sub: `${c[1].toFixed(5)}, ${c[0].toFixed(5)}`, coord: c });
  };

  const rotulos = useMemo(
    () => talhoes.map((x) => ({ id: x.id, nome: x.nome, rotulo: formatarArea(areaM2(x.contorno), unidadeArea), contorno: x.contorno })),
    [talhoes, unidadeArea],
  );

  const escolherTalhao = (id: string) => {
    const x = talhoes.find((z) => z.id === id);
    if (!x || etapa === 'nav') return;
    const n = x.contorno.length || 1;
    tracar({ nome: x.nome, sub: `Talhão · ${x.fazenda}`, coord: [x.contorno.reduce((a, c) => a + c[0], 0) / n, x.contorno.reduce((a, c) => a + c[1], 0) / n] });
  };

  const prox = estado?.proximo;
  const textoBanner = prox?.texto ?? 'Siga até o destino';

  return (
    <View style={{ flex: 1, backgroundColor: t.fundo }}>
      <MapaInterativo
        talhoes={rotulos}
        rascunho={[]}
        poligono
        camada={camada}
        posicao={gps.pos ? { coord: gps.pos.coord, precisaoM: gps.pos.precisaoM } : null}
        comando={comando}
        onAdicionar={aoTocarNoMapa}
        onMover={() => {}}
        onTalhao={escolherTalhao}
        rotas={rotas.map((r) => r.geometria)}
        rotaAtiva={ativa}
        destino={destino?.coord ?? null}
        seguir={etapa === 'nav' ? seguir : null}
        onRota={(i) => { setAtiva(i); setComando({ n: Date.now(), tipo: 'ajustar', pontos: rotas[i].geometria }); }}
      />

      {/* ---------- BUSCA ---------- */}
      {etapa === 'busca' && (
        <View pointerEvents="box-none" style={{ position: 'absolute', top: ins.top + 10, left: 14, right: 14, zIndex: 10, gap: 8 }}>
          <Animated.View entering={FadeInUp.duration(350)}>
            <Vidro>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, height: 54 }}>
                <Ionicons name="search" size={20} color={t.textoSuave} />
                <TextInput
                  value={texto}
                  onChangeText={setTexto}
                  placeholder="Para onde? Cidade, endereço, rodovia…"
                  placeholderTextColor={t.textoSuave}
                  returnKeyType="search"
                  accessibilityLabel="Buscar destino"
                  style={{ flex: 1, fontFamily: fonte.media, fontSize: 16, color: t.texto, outlineWidth: 0 } as any}
                />
                {(buscando || calculando) && <ActivityIndicator color={t.primaria} />}
                {texto.length > 0 && !buscando && (
                  <Pressable onPress={() => setTexto('')} hitSlop={10}><Ionicons name="close-circle" size={20} color={t.textoSuave} /></Pressable>
                )}
              </View>
            </Vidro>
          </Animated.View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable onPress={() => { Haptics.selectionAsync(); setEscolhendo((v) => !v); }}>
              <Vidro raioBorda={raio.pilula}>
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 14, height: 38, backgroundColor: escolhendo ? t.primariaSuave : 'transparent' }}>
                  <Ionicons name="pin" size={16} color={t.primaria} />
                  <Text style={{ fontFamily: fonte.semi, fontSize: 13.5, color: t.texto }}>{escolhendo ? 'Toque no mapa…' : 'Escolher no mapa'}</Text>
                </View>
              </Vidro>
            </Pressable>
          </View>

          {(resultados.length > 0 || (texto.trim().length < 3 && recentes.length > 0)) && (
            <Animated.View entering={FadeInDown.duration(250)}>
              <Vidro>
                <ScrollView style={{ maxHeight: 340 }} keyboardShouldPersistTaps="handled">
                  {texto.trim().length < 3 && <Text style={[tipo.legenda, { color: t.textoSuave, padding: 14, paddingBottom: 4 }]}>RECENTES</Text>}
                  {(resultados.length > 0 ? resultados : recentes).map((l, i) => (
                    <Pressable
                      key={`${l.nome}-${i}`}
                      onPress={() => { Haptics.selectionAsync(); tracar(l); }}
                      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: pressed ? t.primariaSuave : 'transparent', borderTopWidth: i ? 0.5 : 0, borderTopColor: t.linha })}
                    >
                      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: t.primariaSuave, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name={resultados.length ? 'location' : 'time'} size={18} color={t.primaria} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={{ fontFamily: fonte.semi, fontSize: 15.5, color: t.texto }}>{l.nome}</Text>
                        <Text numberOfLines={1} style={[tipo.legenda, { color: t.textoSuave }]}>{l.sub}</Text>
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              </Vidro>
            </Animated.View>
          )}
        </View>
      )}

      {/* ---------- PRÉVIA ---------- */}
      {etapa === 'previa' && rota && (
        <Animated.View entering={FadeInUp.duration(350)} style={{ position: 'absolute', left: 14, right: 14, bottom: Math.max(ins.bottom, 12) + 92, zIndex: 10 }}>
          <Vidro>
            <View style={{ padding: 16, gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="location" size={20} color={t.perigo} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={[tipo.subtitulo, { color: t.texto }]}>{destino?.nome}</Text>
                  <Text numberOfLines={1} style={[tipo.legenda, { color: t.textoSuave }]}>{destino?.sub}</Text>
                </View>
                <Pressable onPress={encerrar} hitSlop={10}><Ionicons name="close-circle" size={26} color={t.textoSuave} /></Pressable>
              </View>

              <View style={{ gap: 8 }}>
                {rotas.map((r, i) => {
                  const sel = i === ativa;
                  return (
                    <Pressable
                      key={i}
                      onPress={() => { Haptics.selectionAsync(); setAtiva(i); setComando({ n: Date.now(), tipo: 'ajustar', pontos: r.geometria }); }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: raio.md, backgroundColor: sel ? t.primariaSuave : t.cartaoSuave, borderWidth: 1.5, borderColor: sel ? t.primaria : 'transparent' }}
                    >
                      <Text style={{ fontFamily: fonte.negrito, fontSize: 20, color: sel ? t.primaria : t.texto, fontVariant: ['tabular-nums'] }}>{formatarDuracao(r.duracaoS)}</Text>
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={{ fontFamily: fonte.semi, fontSize: 14, color: t.texto }}>{formatarDistancia(r.distanciaM)}{i === 0 ? ' · mais rápida' : ''}</Text>
                        {r.via ? <Text numberOfLines={1} style={[tipo.legenda, { color: t.textoSuave }]}>{r.via}</Text> : null}
                      </View>
                      {sel && <Ionicons name="checkmark-circle" size={22} color={t.primaria} />}
                    </Pressable>
                  );
                })}
              </View>

              <Botao titulo="Iniciar navegação" tamanho="g" icone={<Ionicons name="navigate" size={20} color={t.sobrePrimaria} />} onPress={iniciar} />
            </View>
          </Vidro>
        </Animated.View>
      )}

      {/* ---------- NAVEGANDO ---------- */}
      {etapa === 'nav' && rota && estado && (
        <>
          <Animated.View entering={FadeInUp.duration(300)} exiting={FadeOutUp.duration(200)} style={{ position: 'absolute', top: ins.top + 10, left: 14, right: 14, zIndex: 10 }}>
            <View style={{ backgroundColor: t.primaria, borderRadius: raio.lg, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } }}>
              <IconeManobra tipoPasso={prox?.tipo ?? 'arrive'} mod={prox?.modificador} cor={t.sobrePrimaria} tamanho={46} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonte.negrito, fontSize: 28, color: t.sobrePrimaria, fontVariant: ['tabular-nums'] }}>{formatarDistancia(estado.distAteProximoM)}</Text>
                <Text numberOfLines={2} style={{ fontFamily: fonte.semi, fontSize: 16, color: t.sobrePrimaria, opacity: 0.92 }}>{recalculando ? 'Recalculando rota…' : textoBanner}</Text>
              </View>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInUp.duration(300)} style={{ position: 'absolute', left: 14, right: 14, bottom: Math.max(ins.bottom, 12) + 92, zIndex: 10 }}>
            <Vidro>
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonte.negrito, fontSize: 22, color: t.primaria, fontVariant: ['tabular-nums'] }}>{formatarDuracao(estado.restanteS)}</Text>
                  <Text style={[tipo.legenda, { color: t.textoSuave }]}>{formatarDistancia(estado.restanteM)} · chegada {horaChegada(estado.restanteS)}</Text>
                </View>
                <Pressable onPress={() => { definirVoz(!vozLigada); if (vozLigada) pararVoz(); }} hitSlop={8} accessibilityLabel="Ligar ou desligar a voz">
                  <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: t.cartaoSuave, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={vozLigada ? 'volume-high' : 'volume-mute'} size={22} color={t.texto} />
                  </View>
                </Pressable>
                <Pressable onPress={() => { if (gps.pos) setSeguir([...gps.pos.coord] as Coord); }} hitSlop={8} accessibilityLabel="Recentralizar">
                  <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: t.cartaoSuave, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="locate" size={22} color={t.texto} />
                  </View>
                </Pressable>
                <Botao titulo="Sair" variante="perigo" onPress={encerrar} />
              </View>
            </Vidro>
          </Animated.View>
        </>
      )}
    </View>
  );
}
