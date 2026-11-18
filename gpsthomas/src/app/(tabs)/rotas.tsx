import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapaInterativo } from '../../components/MapaInterativo';
import { Vidro } from '../../components/Vidro';
import { Botao } from '../../components/Botao';
import { entrarTelaCheia, emStandalone } from '../../nav/tela';
import { AlcaRecolher, PilulaMostrar, Recolhivel } from '../../components/Recolhivel';
import { useLocalizacao } from '../../geo/useLocalizacao';
import { areaM2, type Coord } from '../../geo/medidas';
import { formatarArea, formatarDistancia } from '../../geo/unidades';
import { buscarLugar, type Lugar } from '../../nav/geocodificar';
import { calcularRotas, type Rota } from '../../nav/rota';
import { estadoNavegacao, formatarDuracao, fraseFalada, limiteNoTrecho, prepararRota, projetar } from '../../nav/progresso';
import { rumoEntre, suavizarRumo, velocidadeKmh, formatarKmh, type Amostra } from '../../nav/movimento';
import { IconeVeiculo } from '../../components/IconeVeiculo';
import { VEICULOS } from '../../components/veiculos';
import { falar, manterTelaLigada, pararVoz } from '../../nav/voz';
import { useDados, useUi, type Comando } from '../../store/dados';
import { usePrefs } from '../../store/prefs';
import { useToast } from '../../store/toast';
import { fonte, raio, tipo, useTema, useTemaForcado } from '../../theme';

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
  const { unidadeArea, camada, recentes, lembrarDestino, vozLigada, definirVoz, veiculo, definirVeiculo, favoritos, alternarFavorito, viagemAtiva, definirViagemAtiva, painelRecolhido, definirPainel } = usePrefs();
  const registrarViagem = useDados((x) => x.registrarViagem);
  const forcarTema = useTemaForcado((x) => x.definir);
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
  const [kmh, setKmh] = useState(0);
  const [rumo, setRumo] = useState(0);
  const [semSinal, setSemSinal] = useState(false);

  const idxRef = useRef(0);
  const fora = useRef(0);
  const ultimoRecalculo = useRef(0);
  const falados = useRef<Set<string>>(new Set());
  const abortar = useRef<AbortController | null>(null);
  const hist = useRef<Amostra[]>([]);
  const ultimoPos = useRef(0);
  const aviso = useRef({ excesso: 0, sinal: 0 });
  const viagem = useRef({ inicio: 0, vmax: 0, soma: 0, n: 0 });
  const autoIniciar = useRef(false);

  const rota = rotas[ativa] ?? null;
  const prep = useMemo(() => (rota ? prepararRota(rota) : null), [rota]);
  const estado = useMemo(() => (prep ? estadoNavegacao(prep, along) : null), [prep, along]);

  useEffect(() => { gps.ligar(); }, []);

  // Velocidade e rumo do veículo, a cada posição do GPS
  useEffect(() => {
    const p = gps.pos;
    if (!p) return;
    ultimoPos.current = Date.now();
    setSemSinal(false);
    hist.current = [...hist.current.slice(-5), { coord: p.coord, tempoMs: p.tempoMs, velMs: p.velocidade }];
    const v = velocidadeKmh(hist.current);
    setKmh(v);
    if (v > 4) {
      const h = hist.current;
      const a = h.length > 1 ? h[h.length - 2].coord : null;
      const novo = p.rumo ?? (a && (a[0] !== p.coord[0] || a[1] !== p.coord[1]) ? rumoEntre(a, p.coord) : null);
      if (novo != null) setRumo((r) => suavizarRumo(r, novo, 0.6));
    }
  }, [gps.pos]);

  // Sem posições novas por alguns segundos: considera parado (evita velocidade "congelada")
  useEffect(() => {
    const id = setInterval(() => {
      if (ultimoPos.current && Date.now() - ultimoPos.current > 6000) { hist.current = []; setKmh(0); }
    }, 2000);
    return () => clearInterval(id);
  }, []);

  // Noite: navegação em tema escuro entre 18h e 6h
  useEffect(() => {
    const h = new Date().getHours();
    forcarTema(etapa === 'nav' && (h >= 18 || h < 6) ? 'escuro' : 'auto');
    return () => forcarTema('auto');
  }, [etapa]);

  // Sinal de GPS perdido durante a navegação
  useEffect(() => {
    if (etapa !== 'nav') return;
    const id = setInterval(() => {
      if (Date.now() - ultimoPos.current > 9000 && Date.now() - aviso.current.sinal > 30000) {
        aviso.current.sinal = Date.now();
        setSemSinal(true);
        mostrar('Sinal de GPS fraco ou perdido', 'erro');
        if (usePrefs.getState().vozLigada) falar('Sinal de GPS fraco.');
      }
    }, 3000);
    return () => clearInterval(id);
  }, [etapa]);
  useEffect(() => { if (gps.erro) mostrar(gps.erro, 'erro'); }, [gps.erro]);

  // Destino vindo de outra tela (ex.: "Traçar rota até o talhão")
  useEffect(() => {
    if (!destinoUi) return;
    const l: Lugar = { nome: destinoUi.nome, sub: 'Talhão', coord: destinoUi.coord };
    setDestino(l);
    tracar(l);
  }, [destinoUi?.n]);

  // Retomar a viagem depois de fechar o app: recalcula a partir de onde você está e inicia
  useEffect(() => {
    if (autoIniciar.current && etapa === 'previa' && rota) { autoIniciar.current = false; iniciar(); }
  }, [etapa, rota]);

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
    viagem.current = { inicio: Date.now(), vmax: 0, soma: 0, n: 0 };
    if (destino) definirViagemAtiva({ nome: destino.nome, sub: destino.sub, coord: destino.coord });
    if (vozLigada) falar(`Iniciando a rota. ${rota.passos[0]?.texto ?? ''}. Destino a ${formatarDistancia(rota.distanciaM).replace('.', ',')}.`);
  };

  const encerrar = (concluida = false) => {
    if (etapa === 'nav' && destino && rota && viagem.current.inicio) {
      const dur = (Date.now() - viagem.current.inicio) / 1000;
      const andou = concluida ? rota.distanciaM : along;
      if (andou > 200) {
        registrarViagem({ destino: destino.nome, inicioMs: viagem.current.inicio, fimMs: Date.now(), distanciaM: andou, vmedKmh: dur > 0 ? (andou / dur) * 3.6 : 0, vmaxKmh: viagem.current.vmax });
      }
    }
    definirViagemAtiva(null);
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
      encerrar(true);
      return;
    }

    // Estatísticas da viagem e alerta de excesso de velocidade
    const v = velocidadeKmh(hist.current);
    if (v > 3) { viagem.current.soma += v; viagem.current.n += 1; }
    viagem.current.vmax = Math.max(viagem.current.vmax, v);
    const lim = limiteNoTrecho(prep, pr.idx);
    if (vozLigada && lim && v > lim + 7 && Date.now() - aviso.current.excesso > 30000) {
      aviso.current.excesso = Date.now();
      falar(`Atenção, limite de ${lim} quilômetros por hora.`);
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

  const linkMapas = (c: Coord) => `https://www.google.com/maps/dir/?api=1&destination=${c[1]},${c[0]}&travelmode=driving`;
  const abrirExterno = (url: string) => { Linking.openURL(url).catch(() => mostrar('Não foi possível abrir o aplicativo.', 'erro')); };
  const compartilhar = async () => {
    if (!destino || !estado) return;
    const msg = `Estou a caminho de ${destino.nome}. Chego por volta das ${horaChegada(estado.restanteS)} (faltam ${formatarDistancia(estado.restanteM)}).\n${linkMapas(destino.coord)}`;
    try {
      if (Platform.OS === 'web' && (navigator as any).share) await (navigator as any).share({ title: 'Minha viagem', text: msg });
      else abrirExterno(`https://wa.me/?text=${encodeURIComponent(msg)}`);
    } catch {}
  };

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
        veiculo={etapa === 'nav' && gps.pos ? { tipo: veiculo, rumo, coord: gps.pos.coord } : null}
        progressoIdx={etapa === 'nav' ? idxRef.current : 0}
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
                  editable={kmh < 8}
                  placeholder={kmh < 8 ? 'Para onde? Cidade, endereço, rodovia…' : 'Pare o veículo para buscar um destino'}
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

          {viagemAtiva && texto.trim().length < 3 && (
            <Animated.View entering={FadeInDown.duration(250)}>
              <Vidro>
                <View style={{ padding: 14, gap: 10 }}>
                  <Text style={{ fontFamily: fonte.semi, fontSize: 15, color: t.texto }}>Você tem uma viagem em andamento para {viagemAtiva.nome}</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Botao titulo="Retomar" icone={<Ionicons name="play" size={18} color={t.sobrePrimaria} />} onPress={() => { autoIniciar.current = true; tracar({ nome: viagemAtiva.nome, sub: viagemAtiva.sub, coord: viagemAtiva.coord }); }} />
                    <Botao titulo="Descartar" variante="suave" onPress={() => definirViagemAtiva(null)} />
                  </View>
                </View>
              </Vidro>
            </Animated.View>
          )}

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

          {texto.trim().length < 3 && favoritos.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {favoritos.map((f) => (
                <Pressable key={f.nome} onPress={() => { Haptics.selectionAsync(); tracar(f); }}>
                  <Vidro raioBorda={raio.pilula}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 38 }}>
                      <Ionicons name="star" size={15} color={t.atencao} />
                      <Text style={{ fontFamily: fonte.semi, fontSize: 13.5, color: t.texto }}>{f.nome}</Text>
                    </View>
                  </Vidro>
                </Pressable>
              ))}
            </ScrollView>
          )}

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
        <Recolhivel recolhido={painelRecolhido} style={{ position: 'absolute', left: 14, right: 14, bottom: Math.max(ins.bottom, 12) + 92, zIndex: 10 }}>
          <Vidro>
            <View style={{ padding: 16, paddingTop: 4, gap: 12 }}>
              <AlcaRecolher onRecolher={() => { definirPainel(true); if (!emStandalone()) entrarTelaCheia(); }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="location" size={20} color={t.perigo} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={[tipo.subtitulo, { color: t.texto }]}>{destino?.nome}</Text>
                  <Text numberOfLines={1} style={[tipo.legenda, { color: t.textoSuave }]}>{destino?.sub}</Text>
                </View>
                {destino && (
                  <Pressable onPress={() => alternarFavorito({ nome: destino.nome, sub: destino.sub, coord: destino.coord })} hitSlop={10} accessibilityLabel="Favoritar destino">
                    <Ionicons name={favoritos.some((f) => f.nome === destino.nome) ? 'star' : 'star-outline'} size={24} color={t.atencao} />
                  </Pressable>
                )}
                <Pressable onPress={() => encerrar()} hitSlop={10}><Ionicons name="close-circle" size={26} color={t.textoSuave} /></Pressable>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {VEICULOS.map((v) => {
                  const sel = v.id === veiculo;
                  return (
                    <Pressable key={v.id} onPress={() => { Haptics.selectionAsync(); definirVeiculo(v.id); }} accessibilityLabel={`Veículo: ${v.rotulo}`}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 14, paddingLeft: 4, height: 46, borderRadius: raio.pilula, backgroundColor: sel ? t.primariaSuave : t.cartaoSuave, borderWidth: 1.5, borderColor: sel ? t.primaria : 'transparent' }}>
                      <IconeVeiculo tipo={v.id} cor={t.primaria} tamanho={38} />
                      <Text style={{ fontFamily: fonte.semi, fontSize: 13.5, color: t.texto }}>{v.rotulo}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

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
              {destino && (
                <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
                  <Pressable onPress={() => abrirExterno(linkMapas(destino.coord))}><Text style={{ fontFamily: fonte.semi, fontSize: 13.5, color: t.primaria }}>Abrir no Google Maps</Text></Pressable>
                  <Text style={{ color: t.textoSuave }}>·</Text>
                  <Pressable onPress={() => abrirExterno(`https://waze.com/ul?ll=${destino.coord[1]},${destino.coord[0]}&navigate=yes`)}><Text style={{ fontFamily: fonte.semi, fontSize: 13.5, color: t.primaria }}>Abrir no Waze</Text></Pressable>
                </View>
              )}
            </View>
          </Vidro>
        </Recolhivel>
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

          <Animated.View entering={FadeInUp.duration(300)} style={{ position: 'absolute', left: 14, bottom: painelRecolhido ? Math.max(ins.bottom, 12) + 74 : Math.max(ins.bottom, 12) + 186, zIndex: 10 }}>
            {(() => {
              const lim = prep ? limiteNoTrecho(prep, idxRef.current) : null;
              const excesso = lim != null && kmh > lim + 5;
              return (
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
                  <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: excesso ? t.perigo : t.cartao, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: excesso ? '#fff' : t.linha, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }} accessibilityLabel={`Velocidade ${formatarKmh(kmh)} quilômetros por hora`}>
                    <Text style={{ fontFamily: fonte.negrito, fontSize: 32, lineHeight: 34, color: excesso ? '#fff' : t.texto, fontVariant: ['tabular-nums'] }}>{formatarKmh(kmh)}</Text>
                    <Text style={{ fontFamily: fonte.semi, fontSize: 11, color: excesso ? '#fff' : t.textoSuave }}>km/h</Text>
                  </View>
                  {lim != null && (
                    <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#fff', borderWidth: 5, borderColor: '#E5484D', alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={`Limite ${lim}`}>
                      <Text style={{ fontFamily: fonte.negrito, fontSize: 16, color: '#111' }}>{lim}</Text>
                    </View>
                  )}
                  {(semSinal || (gps.pos?.precisaoM ?? 0) > 50) && (
                    <View style={{ height: 32, paddingHorizontal: 10, borderRadius: 16, backgroundColor: t.atencao, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 }}>
                      <Ionicons name="warning" size={14} color="#1a1200" />
                      <Text style={{ fontFamily: fonte.semi, fontSize: 12, color: '#1a1200' }}>GPS fraco</Text>
                    </View>
                  )}
                </View>
              );
            })()}
          </Animated.View>

          <Recolhivel recolhido={painelRecolhido} style={{ position: 'absolute', left: 14, right: 14, bottom: Math.max(ins.bottom, 12) + 92, zIndex: 10 }}>
            <Vidro>
              <AlcaRecolher onRecolher={() => { definirPainel(true); if (!emStandalone()) entrarTelaCheia(); }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, paddingTop: 2, gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonte.negrito, fontSize: 22, color: t.primaria, fontVariant: ['tabular-nums'] }}>{formatarDuracao(estado.restanteS)}</Text>
                  <Text style={[tipo.legenda, { color: t.textoSuave }]}>{formatarDistancia(estado.restanteM)} · chegada {horaChegada(estado.restanteS)}</Text>
                </View>
                <Pressable onPress={() => { definirVoz(!vozLigada); if (vozLigada) pararVoz(); }} hitSlop={8} accessibilityLabel="Ligar ou desligar a voz">
                  <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: t.cartaoSuave, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={vozLigada ? 'volume-high' : 'volume-mute'} size={22} color={t.texto} />
                  </View>
                </Pressable>
                <Pressable onPress={compartilhar} hitSlop={8} accessibilityLabel="Compartilhar viagem">
                  <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: t.cartaoSuave, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="share-social" size={22} color={t.texto} />
                  </View>
                </Pressable>
                <Pressable onPress={() => { if (gps.pos) setSeguir([...gps.pos.coord] as Coord); }} hitSlop={8} accessibilityLabel="Recentralizar">
                  <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: t.cartaoSuave, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="locate" size={22} color={t.texto} />
                  </View>
                </Pressable>
                <Botao titulo="Sair" variante="perigo" onPress={() => encerrar()} />
              </View>
            </Vidro>
          </Recolhivel>
        </>
      )}

      <PilulaMostrar
        visivel={painelRecolhido && (etapa === 'previa' || etapa === 'nav')}
        rotulo={etapa === 'nav' && estado ? `${formatarDuracao(estado.restanteS)} · ${formatarDistancia(estado.restanteM)}` : 'Mostrar rotas'}
        onPress={() => definirPainel(false)}
      />
    </View>
  );
}
