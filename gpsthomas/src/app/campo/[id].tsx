import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapaInterativo } from '../../components/MapaInterativo';
import { Cartao } from '../../components/Cartao';
import { Botao } from '../../components/Botao';
import { Campo } from '../../components/Campo';
import { Fichas } from '../../components/Fichas';
import { Vidro } from '../../components/Vidro';
import { FolhaBandeira } from '../../components/FolhaBandeira';
import { AlcaRecolher, PilulaMostrar, Recolhivel } from '../../components/Recolhivel';
import { Paralaxe } from '../../components/Paralaxe';
import { Revelar } from '../../components/Revelar';
import { useDados, useUi, type Comando } from '../../store/dados';
import { usePrefs } from '../../store/prefs';
import { useToast } from '../../store/toast';
import { useLocalizacao } from '../../geo/useLocalizacao';
import { CORES_VARIEDADE, compararComMeta, conferirAreas, distribuirVariedades, textoOrigens, totaisPorVariedade } from '../../geo/campo';
import { formatarHa } from '../../geo/unidades';
import { formatarPercentual, lerNumeroBR, paraCampoBR } from '../../geo/numero';
import { Dica } from '../../components/Dica';
import { PRECISAO_MAX_GUIA_M, atualizarChegada, desvioLateral, degrauDeAviso, escolherRumo, guiaAtePonto, ordenarVisita, textoDesvio, textoGiro, type EstadoChegada } from '../../nav/guiaPonto';
import { AprendizDesvio, aplicarDeslocamento, calcularDeslocamento, declinacaoAproximada, deslocamentoAtivo, rumoVerdadeiro, textoDeslocamento } from '../../nav/calibracao';
import { qualidadeGps } from '../../nav/filtroGps';
import { lerLatLon } from '../../geo/rastro';
import { useBussola } from '../../nav/bussola';
import { falar, manterTelaLigada, pararVoz } from '../../nav/voz';
import { rumoEntre } from '../../nav/movimento';
import { paraCSV2, paraGeoJSONCampo, paraKMLCampo, pontosExport } from '../../io/campo';
import { baixarPdfCampo, type DadosPdf } from '../../io/pdfCampo';
import { imprimirPlano } from '../../io/htmlImpressao';
import { entregarArquivo } from '../../io/arquivos';
import { fonte, raio, tipo, useTema } from '../../theme';
import type { Coord } from '../../geo/medidas';

const ha = (m2: number) => formatarHa(m2);

export default function CampoTela() {
  const t = useTema();
  const ins = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const plano = useDados((s) => s.campos.find((c) => c.id === id));
  const talhoes = useDados((s) => s.talhoes);
  const { atualizarCampo, removerCampo } = useDados();
  const { camada, vozLigada, painelRecolhido, definirPainel, desvioBussolaGraus, definirDesvioBussola, calibracaoGps, definirCalibracaoGps } = usePrefs();
  const irPara = useUi((x) => x.irPara);
  const { height: alturaTela } = useWindowDimensions();
  const mostrar = useToast((s) => s.mostrar);
  const gps = useLocalizacao();

  const [guiando, setGuiando] = useState(false);
  const [textoVar, setTextoVar] = useState('');
  const [comando, setComando] = useState<Comando | null>(null);
  const [pulados, setPulados] = useState<string[]>([]);
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [alvoManual, setAlvoManual] = useState<string | null>(null);
  const [mapaCheio, setMapaCheio] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [calibrandoBussola, setCalibrandoBussola] = useState(false);
  const [calibGpsAberto, setCalibGpsAberto] = useState(false);
  const [coordTxt, setCoordTxt] = useState({ lat: '', lon: '' });
  const [chegada, setChegada] = useState<EstadoChegada>({ dentro: false, seguidos: 0 });
  const aprendiz = useRef(new AprendizDesvio());
  const [verTodas, setVerTodas] = useState(false);
  const [metaTxt, setMetaTxt] = useState('');
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { scrollY.value = e.contentOffset.y; });
  const alturaMapa = useSharedValue(300 + ins.top);
  const sobeSheet = useSharedValue(0);
  useEffect(() => {
    alturaMapa.value = withSpring(mapaCheio ? alturaTela : 300 + ins.top, { damping: 24, stiffness: 190 });
    sobeSheet.value = withSpring(mapaCheio ? 1 : 0, { damping: 24, stiffness: 190 });
  }, [mapaCheio, alturaTela, ins.top]);
  const eMapa = useAnimatedStyle(() => ({ height: alturaMapa.value }));
  const eSheet = useAnimatedStyle(() => ({ transform: [{ translateY: sobeSheet.value * alturaTela }] }));
  const avisado = useRef<{ id: string; degrau: number }>({ id: '', degrau: 0 });
  const chegou = useRef<string>('');
  const ultimoRumo = useRef<number | null>(null);
  const bussola = useBussola(guiando);

  useEffect(() => { if (plano && textoVar === '') setTextoVar(plano.variedades.join('\n')); }, [plano?.id]);
  useEffect(() => { if (plano) setMetaTxt(plano.metaHa ? paraCampoBR(plano.metaHa) : ''); }, [plano?.id]);

  const variedades = plano?.variedades ?? [];
  const corDe = (v: string) => { const i = variedades.indexOf(v); return CORES_VARIEDADE[(i < 0 ? CORES_VARIEDADE.length - 1 : i) % CORES_VARIEDADE.length]; };

  const parcelas = useMemo(
    () => (plano?.partes ?? []).map((p, i) => ({
      id: `${p.talhaoId}-${p.indice}`, pedacos: p.pedacos, cor: p.variedade ? corDe(p.variedade) : '#8FA39A',
      rotulo: p.variedade || `Parte ${i + 1}`, sub: ha(p.areaM2),
    })),
    [plano],
  );

  const pendentes = useMemo(() => (plano?.bandeiras ?? []).filter((b) => !b.colocada), [plano]);
  const colocadas = (plano?.bandeiras.length ?? 0) - pendentes.length;

  // Alvo atual: o mais perto da última bandeira colocada (ou de você), pulando os que você adiou
  const alvo = useMemo(() => {
    if (!plano || pendentes.length === 0) return null;
    const manual = alvoManual ? pendentes.find((b) => b.id === alvoManual) : null;
    if (manual) return manual;
    const ult = [...plano.bandeiras].reverse().find((b) => b.colocada)?.coord ?? gps.pos?.coord ?? null;
    const livres = pendentes.filter((b) => !pulados.includes(b.id));
    const lista = livres.length ? livres : pendentes;
    return ordenarVisita(lista, ult)[0] ?? null;
  }, [plano, pendentes, pulados, alvoManual, gps.pos ? 1 : 0]);

  // Posição usada pelo guia: já filtrada e com o ajuste de calibração do GPS (se houver)
  const posGuia = useMemo(() => (gps.pos ? { ...gps.pos, coord: aplicarDeslocamento(gps.pos.coord, calibracaoGps) } : null), [gps.pos, calibracaoGps]);
  const declinacao = useMemo(() => declinacaoAproximada(gps.pos?.coord ?? plano?.bandeiras[0]?.coord ?? [-47.9, -15.8]), [gps.pos ? 1 : 0, plano?.id]);
  const desvioBussola = desvioBussolaGraus ?? declinacao;

  // Aprende o desvio da bússola andando: o GPS dá o rumo verdadeiro e a bússola o magnético
  useEffect(() => {
    const p = gps.pos;
    if (!p || !guiando) return;
    const est = aprendiz.current.adicionar(p.rumo, p.velocidade, bussola.rumo);
    if (est == null) return;
    const am = aprendiz.current.amostras;
    if (am >= 6 && aprendiz.current.confianca() >= 0.6 && am % 3 === 0) definirDesvioBussola(est, true);
    if (calibrandoBussola && am >= 10) {
      definirDesvioBussola(est, true);
      setCalibrandoBussola(false);
      mostrar(`Bússola ajustada (${Math.round(est > 180 ? est - 360 : est)}°)`, 'ok');
    }
  }, [gps.pos, guiando]);

  const bussolaVerdadeira = bussola.rumo != null ? rumoVerdadeiro(bussola.rumo, desvioBussola) : null;
  const { rumo: rumoVirado, fonte: fonteRumo } = escolherRumo({ gpsRumo: gps.pos?.rumo ?? null, gpsVelMs: gps.pos?.velocidade ?? null, bussolaVerdadeira, ultimo: ultimoRumo.current });
  useEffect(() => { if (fonteRumo === 'gps' && rumoVirado != null) ultimoRumo.current = rumoVirado; }, [rumoVirado, fonteRumo]);
  const precisao = gps.pos?.precisaoM ?? null;
  const precisaoOk = precisao != null && precisao <= PRECISAO_MAX_GUIA_M;
  const guia = alvo && posGuia ? guiaAtePonto(posGuia.coord, alvo.coord, precisaoOk ? rumoVirado : null) : null;
  const colocadoAnterior = alvo && plano ? [...plano.bandeiras].reverse().find((b) => b.colocada && b.linha === alvo.linha) : null;
  const desvio = alvo && posGuia && colocadoAnterior ? desvioLateral(posGuia.coord, colocadoAnterior.coord, alvo.coord) : null;
  // "Chegou" estável: 3 leituras boas seguidas; só sai acima de 5 m
  useEffect(() => { if (guia) setChegada((c) => atualizarChegada(c, guia.distanciaM, precisao)); }, [guia?.distanciaM, precisao]);
  useEffect(() => { setChegada({ dentro: false, seguidos: 0 }); }, [alvo?.id]);
  const nessePonto = chegada.dentro && !!guia && guia.distanciaM <= 5;

  // Já deixa o GPS ligado ao abrir o plano (se o aparelho já deu permissão) para ele estabilizar antes do guia
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const st = await (navigator as any).permissions?.query({ name: 'geolocation' });
        if (vivo && st?.state === 'granted') gps.ligar();
      } catch {}
    })();
    return () => { vivo = false; };
  }, [plano?.id]);

  // Voz, vibração e "Chegou"
  useEffect(() => {
    if (!guiando || !alvo || !guia) return;
    const d = guia.distanciaM;
    if (avisado.current.id !== alvo.id) avisado.current = { id: alvo.id, degrau: 0 };
    const deg = degrauDeAviso(d);
    if (deg && (avisado.current.degrau === 0 || deg < avisado.current.degrau) && !nessePonto) {
      avisado.current.degrau = deg;
      if (vozLigada) falar(`Faltam ${deg} metros.`);
    }
    if (nessePonto && chegou.current !== alvo.id) {
      chegou.current = alvo.id;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      try { (navigator as any).vibrate?.([200, 100, 200]); } catch {}
      if (vozLigada) falar('Chegou. Coloque a bandeirinha.');
    }
  }, [guia?.distanciaM, alvo?.id, guiando]);

  const marcar = (idB: string, colocada: boolean) => {
    if (!plano) return;
    atualizarCampo(plano.id, { bandeiras: plano.bandeiras.map((b) => (b.id === idB ? { ...b, colocada } : b)) });
  };

  /** Calibra o GPS: o ponto conhecido deve ser onde você está AGORA; o app guarda a diferença e a aplica ao guia. */
  const aplicarCalibracao = (conhecido: Coord) => {
    if (!gps.pos) { mostrar('Espere o GPS achar sua posição.', 'info'); return; }
    if ((gps.pos.precisaoM ?? 99) > PRECISAO_MAX_GUIA_M) { mostrar(`Espere o GPS melhorar (até ±${PRECISAO_MAX_GUIA_M} m) para calibrar.`, 'info'); return; }
    const d = calcularDeslocamento(conhecido, gps.pos.coord);
    if (Math.hypot(d.dxM, d.dyM) > 60) { mostrar('Esse ponto está a mais de 60 m de você. Vá até ele antes de calibrar.', 'erro'); return; }
    definirCalibracaoGps(d);
    setCalibGpsAberto(false);
    mostrar(`GPS ajustado em ${textoDeslocamento(d)}`, 'ok');
  };
  const referenciasCalibracao = [
    ...(plano?.junto?.linhaAB ? [{ nome: `Ponto A da linha ${plano.junto.linhaAB.nome}`, coord: plano.junto.linhaAB.a }, { nome: `Ponto B da linha ${plano.junto.linhaAB.nome}`, coord: plano.junto.linhaAB.b }] : []),
    ...(() => { const u = plano ? [...plano.bandeiras].reverse().find((x) => x.colocada) : null; return u ? [{ nome: `Última bandeira colocada (${u.rotulo})`, coord: u.coord }] : []; })(),
  ];

  const bandeiraSel = plano?.bandeiras.find((b) => b.id === selecionada) ?? null;
  const distDe = (c: Coord) => (posGuia ? guiaAtePonto(posGuia.coord, c, null).distanciaM : null);
  const guiarAte = async (idB: string) => {
    setSelecionada(null);
    setAlvoManual(idB);
    setPulados([]);
    const b = plano?.bandeiras.find((x) => x.id === idB);
    if (!guiando) await iniciarGuia();
    if (b) setComando({ n: Date.now(), tipo: 'ajustar', pontos: [b.coord, ...(posGuia ? [posGuia.coord] : [])] });
  };

  const dadosImpressao = (): DadosPdf | null => {
    if (!plano) return null;
    const fazenda = talhoes.find((x) => x.id === plano.config[0]?.talhaoId)?.fazenda;
    return { plano, nomeTalhao: (idT) => (idT === 'junto' && plano.junto ? plano.junto.talhaoIds.map((i) => talhoes.find((x) => x.id === i)?.nome ?? 'Talhão').join(' + ') : talhoes.find((x) => x.id === idT)?.nome ?? 'Talhão'), fazenda, talhoes };
  };

  const gerarPdf = async () => {
    if (Platform.OS !== 'web') { mostrar('O PDF está disponível na versão web/PWA por enquanto.', 'info'); return; }
    const dados = dadosImpressao();
    if (!dados) return;
    setGerandoPdf(true);
    try {
      if (await baixarPdfCampo(dados)) mostrar('PDF gerado', 'ok');
    } catch { mostrar('Não foi possível gerar o PDF.', 'erro'); }
    finally { setGerandoPdf(false); }
  };

  /** Abre direto a tela de impressão com o plano (no app Android usa a impressão do sistema). */
  const imprimir = async () => {
    const dados = dadosImpressao();
    if (!dados) return;
    try {
      const r = await imprimirPlano(dados);
      if (r === 'indisponivel') mostrar('Impressão indisponível aqui. Use "Baixar PDF".', 'info');
    } catch (e: any) { mostrar(`Não foi possível abrir a impressão: ${e?.message ?? e}`, 'erro'); }
  };

  const iniciarGuia = async () => {
    await gps.ligar();
    setGuiando(true);
    manterTelaLigada(true);
    if (alvo) setComando({ n: Date.now(), tipo: 'ajustar', pontos: [alvo.coord, ...(posGuia ? [posGuia.coord] : [])] });
    if (vozLigada) falar('Guia das bandeirinhas iniciado.');
  };
  const sairGuia = () => { setGuiando(false); pararVoz(); manterTelaLigada(false); };

  const confirmarColocada = () => {
    if (!alvo) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    marcar(alvo.id, true);
    setPulados([]);
    setAlvoManual(null);
    if (pendentes.length === 1) {
      mostrar('Todas as bandeirinhas foram colocadas!', 'ok');
      if (vozLigada) falar('Todas as bandeirinhas foram colocadas.');
      sairGuia();
    }
  };

  if (!plano) {
    return (
      <View style={{ flex: 1, backgroundColor: t.fundo, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <Text style={[tipo.subtitulo, { color: t.texto }]}>Plano não encontrado</Text>
        <Botao titulo="Voltar" onPress={() => router.back()} />
      </View>
    );
  }

  const salvarVariedades = () => {
    const lista = [...new Set(textoVar.split('\n').map((x) => x.trim()).filter(Boolean))];
    // mantém quem já estava atribuído, se o nome ainda existe
    const partes = plano.partes.map((p) => ({ ...p, variedade: lista.includes(p.variedade) ? p.variedade : '' }));
    const final = partes.some((p) => !p.variedade) ? distribuirVariedades(partes, lista).map((p, i) => (partes[i].variedade ? partes[i] : p)) : partes;
    atualizarCampo(plano.id, { variedades: lista, partes: final });
    mostrar('Variedades salvas e distribuídas nas partes', 'ok');
  };

  const confirmar = (msg: string, ok: () => void) => {
    if (Platform.OS === 'web') { if (window.confirm(msg)) ok(); }
    else Alert.alert('Confirmar', msg, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Sim', onPress: ok }]);
  };
  const confirmarExcluir = () => {
    const ok = () => { removerCampo(plano.id); router.back(); };
    if (Platform.OS === 'web') { if (window.confirm(`Excluir o plano "${plano.nome}"?`)) ok(); }
    else Alert.alert('Excluir plano', plano.nome, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Excluir', style: 'destructive', onPress: ok }]);
  };

  const mapa = (
    <MapaInterativo
      talhoes={[]}
      rascunho={[]}
      poligono
      camada={camada}
      posicao={posGuia ? { coord: posGuia.coord, precisaoM: posGuia.precisaoM } : null}
      comando={comando ?? { n: 1, tipo: 'ajustar', pontos: plano.partes.flatMap((p) => p.pedacos.flat()) }}
      onAdicionar={() => {}}
      onMover={() => {}}
      onTalhao={() => {}}
      parcelas={parcelas}
      rastro={plano.junto?.linhaAB && plano.junto.usarLinhaAB ? plano.junto.linhaAB : null}
      bandeiras={plano.bandeiras.map((b) => ({ id: b.id, coord: b.coord, estado: b.colocada ? 'ok' : guiando && alvo?.id === b.id ? 'atual' : 'pendente', rotulo: b.rotulo }))}
      linhaGuia={guiando && alvo && posGuia ? [posGuia.coord, alvo.coord] : null}
      onBandeira={(idB) => { Haptics.selectionAsync(); setSelecionada(idB); }}
    />
  );

  /* ---------------- MODO GUIA ---------------- */
  if (guiando) {
    const giro = guia?.giroGraus ?? null;
    const perto = guia ? guia.distanciaM <= 8 : false;
    return (
      <View style={{ flex: 1, backgroundColor: t.fundo }}>
        {mapa}
        <Animated.View entering={FadeInUp.duration(300)} style={{ position: 'absolute', top: ins.top + 10, left: 14, right: 14, zIndex: 10, gap: 8 }}>
          <View style={{ backgroundColor: nessePonto ? t.ok : t.primaria, borderRadius: raio.lg, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
              {nessePonto ? <Ionicons name="flag" size={34} color="#fff" /> : giro == null ? <Ionicons name="walk" size={36} color="#fff" /> : <SetaGuia giro={giro} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonte.negrito, fontSize: 34, color: '#fff', fontVariant: ['tabular-nums'] }} accessibilityLabel="Distância até o ponto">
                {guia ? `${precisaoOk ? '' : '~'}${guia.distanciaM < 100 ? guia.distanciaM.toFixed(1).replace('.', ',') : Math.round(guia.distanciaM)} m` : '—'}
              </Text>
              <Text numberOfLines={2} style={{ fontFamily: fonte.semi, fontSize: 15.5, color: '#fff', opacity: 0.95 }}>
                {!gps.pos ? 'Buscando sinal de GPS…' : !precisaoOk ? `Aguardando GPS preciso (±${Math.round(precisao ?? 0)} m)` : nessePonto ? 'Chegou! Coloque a bandeirinha' : textoGiro(giro)}
              </Text>
            </View>
          </View>
          {alvo && (
            <Vidro raioBorda={raio.md}>
              <View style={{ paddingVertical: 10, paddingHorizontal: 14, gap: 2 }}>
                <Text numberOfLines={1} style={{ fontFamily: fonte.semi, fontSize: 14.5, color: t.texto }}>{alvo.rotulo}</Text>
                <Text style={[tipo.legenda, { color: t.textoSuave }]}>
                  Bandeira {colocadas + 1} de {plano.bandeiras.length}
                  {desvio != null && guia && guia.distanciaM > 3 ? ` · ${textoDesvio(desvio)}` : ''}
                </Text>
              </View>
            </Vidro>
          )}
          <Vidro raioBorda={raio.md}>
            <View style={{ padding: 10, gap: 8 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                <Text accessibilityLabel="Situação do GPS" style={{ fontFamily: fonte.semi, fontSize: 12.5, color: precisao == null ? t.textoSuave : precisao <= 8 ? t.ok : precisao <= 15 ? t.atencao : t.perigo }}>
                  {precisao == null ? 'GPS buscando…' : `GPS ±${Math.round(precisao)} m · ${{ pronto: 'pronto', estabilizando: 'estabilizando', procurando: 'procurando' }[qualidadeGps(precisao)]}`}
                </Text>
                <Text style={{ fontFamily: fonte.regular, fontSize: 12.5, color: t.textoSuave }}>
                  · {fonteRumo === 'gps' ? 'direção pelo GPS (andando)' : fonteRumo === 'bussola' ? `bússola ${Math.round(desvioBussola > 180 ? desvioBussola - 360 : desvioBussola)}°${desvioBussolaGraus != null ? ' calibrada' : ' estimada'}` : bussola.disponivel === false ? 'sem bússola: ande alguns passos' : 'direção: ande alguns passos'}
                </Text>
                {deslocamentoAtivo(calibracaoGps) && <Text style={{ fontFamily: fonte.regular, fontSize: 12.5, color: t.textoSuave }}>· ajuste do GPS {textoDeslocamento(calibracaoGps!)}</Text>}
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Botao titulo="Calibrar bússola" variante="suave" style={{ flex: 1 }} onPress={() => { aprendiz.current.reiniciar(); setCalibrandoBussola(true); }} />
                <Botao titulo="Calibrar GPS" variante="suave" style={{ flex: 1 }} onPress={() => setCalibGpsAberto(true)} />
              </View>
              {calibrandoBussola && (
                <Text style={{ fontFamily: fonte.semi, fontSize: 13.5, color: t.texto }}>
                  Ande em linha reta por uns 10 passos largos, sem parar e sem mexer no celular ({Math.min(10, aprendiz.current.amostras)}/10). Se a seta ainda errar, faça um "8" no ar com o celular.
                </Text>
              )}
            </View>
          </Vidro>
          {precisao != null && precisao > 8 && (
            <Vidro raioBorda={raio.md}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10 }}>
                <Ionicons name="warning" size={18} color={t.atencao} />
                <Text style={{ fontFamily: fonte.semi, fontSize: 13, color: t.texto, flex: 1 }}>{precisao > PRECISAO_MAX_GUIA_M ? `GPS fraco (±${Math.round(precisao)} m). Saia de baixo de árvores e construções e espere estabilizar: a seta volta quando passar de ${PRECISAO_MAX_GUIA_M} m.` : `GPS com precisão de ±${Math.round(precisao)} m. Espere melhorar antes de cravar a bandeira.`}</Text>
              </View>
            </Vidro>
          )}
          {bussola.precisaPermissao && (
            <Vidro raioBorda={raio.pilula}>
              <Pressable onPress={bussola.pedirPermissao} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44 }}>
                <Ionicons name="compass" size={20} color={t.primaria} />
                <Text style={{ fontFamily: fonte.semi, fontSize: 15, color: t.primaria }}>Ativar bússola do celular</Text>
              </Pressable>
            </Vidro>
          )}
        </Animated.View>

        {calibGpsAberto && (
          <View style={{ position: 'absolute', left: 14, right: 14, top: ins.top + 90, zIndex: 40 }}>
            <Cartao style={{ gap: 10 }}>
              <Text style={[tipo.subtitulo, { color: t.texto }]}>Calibrar o GPS</Text>
              <Text style={[tipo.corpo, { color: t.textoSuave }]}>Fique parado sobre um ponto cuja posição você conhece bem (de uma fonte melhor que o celular, como o ponto A da linha do monitor) e toque nele. O app corrige o GPS por essa diferença durante 3 horas.</Text>
              {referenciasCalibracao.map((r) => (
                <Botao key={r.nome} titulo={r.nome} variante="suave" onPress={() => aplicarCalibracao(r.coord)} />
              ))}
              <Text style={[tipo.legenda, { color: t.textoSuave }]}>OU DIGITE AS COORDENADAS DO PONTO</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}><Campo rotulo="" value={coordTxt.lat} onChangeText={(v) => setCoordTxt((c) => ({ ...c, lat: v }))} placeholder="Latitude" keyboardType="numbers-and-punctuation" compacto accessibilityLabel="Latitude do ponto conhecido" /></View>
                <View style={{ flex: 1 }}><Campo rotulo="" value={coordTxt.lon} onChangeText={(v) => setCoordTxt((c) => ({ ...c, lon: v }))} placeholder="Longitude" keyboardType="numbers-and-punctuation" compacto accessibilityLabel="Longitude do ponto conhecido" /></View>
              </View>
              <Botao titulo="Usar estas coordenadas" variante="suave" onPress={() => { const c = lerLatLon(coordTxt.lat, coordTxt.lon); if (!c) mostrar('Coordenadas inválidas (ex.: -16.282406 e -46.134161).', 'erro'); else aplicarCalibracao(c); }} />
              {deslocamentoAtivo(calibracaoGps) && <Botao titulo="Remover o ajuste do GPS" variante="fantasma" onPress={() => { definirCalibracaoGps(null); setCalibGpsAberto(false); mostrar('Ajuste do GPS removido', 'ok'); }} />}
              <Botao titulo="Fechar" variante="fantasma" onPress={() => setCalibGpsAberto(false)} />
            </Cartao>
          </View>
        )}

        <Recolhivel recolhido={painelRecolhido} style={{ position: 'absolute', left: 14, right: 14, bottom: Math.max(ins.bottom, 12) + 16, zIndex: 10 }}>
          <Vidro>
            <AlcaRecolher onRecolher={() => definirPainel(true)} />
            <View style={{ padding: 14, paddingTop: 2, gap: 12 }}>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: t.cartaoSuave, overflow: 'hidden' }}>
                <View style={{ width: `${(colocadas / Math.max(1, plano.bandeiras.length)) * 100}%`, height: 8, backgroundColor: t.primaria }} />
              </View>
              <Text style={[tipo.legenda, { color: t.textoSuave }]}>{colocadas} de {plano.bandeiras.length} bandeirinhas colocadas</Text>
              <Botao
                titulo="Bandeira colocada ✓"
                tamanho="g"
                desabilitado={!alvo || (!perto && !nessePonto)}
                icone={<Ionicons name="flag" size={20} color={t.sobrePrimaria} />}
                onPress={confirmarColocada}
              />
              {!perto && alvo && <Text style={[tipo.legenda, { color: t.textoSuave, textAlign: 'center' }]}>O botão libera a menos de 8 m do ponto.</Text>}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Botao titulo="Pular este" variante="suave" style={{ flex: 1 }} onPress={() => alvo && setPulados((p) => [...p, alvo.id])} />
                <Botao titulo="Sair do guia" variante="perigo" style={{ flex: 1 }} onPress={sairGuia} />
              </View>
              {alvoManual && <Botao titulo="Voltar à ordem automática" variante="fantasma" onPress={() => setAlvoManual(null)} />}
            </View>
          </Vidro>
        </Recolhivel>

        <PilulaMostrar
          visivel={painelRecolhido}
          icone="flag"
          rotulo={guia ? `${guia.distanciaM < 100 ? guia.distanciaM.toFixed(0) : Math.round(guia.distanciaM)} m · ${colocadas}/${plano.bandeiras.length}` : 'Mostrar guia'}
          onPress={() => definirPainel(false)}
        />

        <FolhaBandeira
          visivel={!!bandeiraSel}
          rotulo={bandeiraSel?.rotulo ?? ''}
          colocada={!!bandeiraSel?.colocada}
          distanciaM={bandeiraSel ? distDe(bandeiraSel.coord) : null}
          ehAlvo={!!bandeiraSel && alvo?.id === bandeiraSel.id}
          onGuiar={() => bandeiraSel && guiarAte(bandeiraSel.id)}
          onRota={() => { if (bandeiraSel) { irPara(bandeiraSel.coord, bandeiraSel.rotulo); setSelecionada(null); sairGuia(); router.navigate('/rotas'); } }}
          onAlternar={() => { if (bandeiraSel) { marcar(bandeiraSel.id, !bandeiraSel.colocada); setSelecionada(null); } }}
          onFechar={() => setSelecionada(null)}
        />
      </View>
    );
  }

  /* ---------------- MODO PLANO ---------------- */
  const totais = totaisPorVariedade(plano.partes);
  const conferencia = conferirAreas(plano, talhoes);
  const nomeTalhao = (idT: string) => (idT === 'junto' && plano.junto ? plano.junto.talhaoIds.map((i) => talhoes.find((x) => x.id === i)?.nome ?? 'Talhão').join(' + ') : talhoes.find((x) => x.id === idT)?.nome ?? 'Talhão');
  const exp = (ext: 'kml' | 'geojson' | 'csv' | 'gpx') => {
    const nome = `${plano.nome}.${ext}`;
    if (ext === 'kml') entregarArquivo(nome, paraKMLCampo(plano, nomeTalhao), 'application/vnd.google-earth.kml+xml');
    if (ext === 'geojson') entregarArquivo(nome, paraGeoJSONCampo(plano, nomeTalhao), 'application/geo+json');
    if (ext === 'csv') entregarArquivo(nome, paraCSV2(plano, nomeTalhao), 'text/csv');
    if (ext === 'gpx') entregarArquivo(nome, pontosExport(plano), 'application/gpx+xml');
    mostrar('Arquivo exportado', 'ok');
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.fundo }}>
      <Animated.View style={[{ overflow: 'hidden' }, eMapa]}>
        <Paralaxe y={scrollY} style={{ flex: 1 }}>{mapa}</Paralaxe>
        <Pressable onPress={() => router.back()} style={{ position: 'absolute', top: ins.top + 10, left: 16, width: 42, height: 42, borderRadius: 21, backgroundColor: t.cartao, alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <Ionicons name="chevron-back" size={24} color={t.texto} />
        </Pressable>
        <Pressable onPress={() => { Haptics.selectionAsync(); setMapaCheio((v) => !v); }} accessibilityLabel={mapaCheio ? 'Voltar ao plano' : 'Mapa em tela cheia'} style={{ position: 'absolute', top: ins.top + 10, right: 16, height: 42, paddingHorizontal: 14, borderRadius: 21, backgroundColor: t.cartao, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, zIndex: 10 }}>
          <Ionicons name={mapaCheio ? 'contract' : 'expand'} size={18} color={t.texto} />
          <Text style={{ fontFamily: fonte.semi, fontSize: 13.5, color: t.texto }}>{mapaCheio ? 'Voltar ao plano' : 'Tela cheia'}</Text>
        </Pressable>
      </Animated.View>

      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} style={[{ position: 'absolute', top: 278 + ins.top, left: 0, right: 0, bottom: 0, backgroundColor: t.fundo, borderTopLeftRadius: 26, borderTopRightRadius: 26, overscrollBehaviorY: 'contain', scrollBehavior: 'smooth' } as any, eSheet]} contentContainerStyle={{ padding: 18, paddingBottom: 60, gap: 14 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 14 }}>
          <View style={{ gap: 4 }}>
            <Text style={[tipo.titulo, { color: t.texto }]}>{plano.nome}</Text>
            <Text style={[tipo.corpo, { color: t.textoSuave }]}>{plano.partes.length} partes · {plano.divisas.length} divisas · {plano.bandeiras.length} bandeirinhas</Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Cartao style={{ flex: 1, padding: 14 }}>
              <Text style={[tipo.legenda, { color: t.textoSuave }]}>ÁREA TOTAL</Text>
              <Text numberOfLines={1} style={{ fontFamily: fonte.negrito, fontSize: 20, color: t.primaria, marginTop: 2, fontVariant: ['tabular-nums'] }}>{ha(plano.partes.reduce((s2, p) => s2 + p.areaM2, 0))}</Text>
            </Cartao>
            <Cartao style={{ flex: 1, padding: 14 }}>
              <Text style={[tipo.legenda, { color: t.textoSuave }]}>BANDEIRAS</Text>
              <Text numberOfLines={1} style={{ fontFamily: fonte.negrito, fontSize: 20, color: t.texto, marginTop: 2, fontVariant: ['tabular-nums'] }}>{colocadas}/{plano.bandeiras.length} · {Math.round((colocadas / Math.max(1, plano.bandeiras.length)) * 100)}%</Text>
            </Cartao>
          </View>

          <Botao titulo={colocadas === 0 ? 'Marcar no campo' : colocadas >= plano.bandeiras.length ? 'Tudo colocado ✓' : 'Continuar marcando'} tamanho="g" desabilitado={plano.bandeiras.length === colocadas} icone={<Ionicons name="navigate" size={20} color={t.sobrePrimaria} />} onPress={iniciarGuia} />

          <Botao titulo="Ajustar hectares e divisas" variante="suave" icone={<Ionicons name="options" size={19} color={t.primaria} />} onPress={() => router.push(`/campo/novo?editar=${plano.id}`)} />

          <Cartao style={{ gap: 10 }}>
            <Text style={[tipo.subtitulo, { color: t.texto }]}>Variedades</Text>
            <Text style={[tipo.corpo, { color: t.textoSuave }]}>Uma por linha. Se houver mais partes do que variedades, a última variedade fica com as partes que sobram (você ajusta abaixo).</Text>
            <Campo rotulo="Lista de variedades" value={textoVar} onChangeText={setTextoVar} multiline placeholder={'Variedade 1\nVariedade 2\n…'} />
            <Botao titulo="Salvar e distribuir nas partes" variante="suave" onPress={salvarVariedades} />
          </Cartao>

          <Text style={[tipo.legenda, { color: t.textoSuave }]}>PARTES</Text>
          {plano.partes.map((p, i) => (
            <Revelar key={`${p.talhaoId}-${p.indice}`}>
            <Cartao style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: p.variedade ? corDe(p.variedade) : '#8FA39A' }} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontFamily: fonte.semi, fontSize: 15.5, color: t.texto }}>{plano.junto ? `Parte ${p.indice + 1}` : `${nomeTalhao(p.talhaoId)} · parte ${p.indice + 1}`}</Text>
                  <Text style={[tipo.legenda, { color: t.textoSuave }]}>{p.variedade || 'Sem variedade'}{plano.junto && p.origens?.length ? ` · ${textoOrigens(p, nomeTalhao)}` : ''}</Text>
                </View>
                <Text style={{ fontFamily: fonte.negrito, fontSize: 17, color: t.primaria }}>{ha(p.areaM2)}</Text>
              </View>
              {variedades.length > 0 && (
                <Fichas opcoes={variedades} valor={p.variedade} onChange={(v) => atualizarCampo(plano.id, { partes: plano.partes.map((q, k) => (k === i ? { ...q, variedade: v } : q)) })} />
              )}
            </Cartao>
            </Revelar>
          ))}

          {variedades.length > 0 && (
            <Cartao style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[tipo.subtitulo, { color: t.texto }]}>Total por variedade</Text>
                <Dica texto="Compara a área real de cada variedade com a meta que você definiu (ex.: 16 ha). A tolerância é de 0,3 ha ou 2%, o que for maior." />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
                <View style={{ width: 150 }}>
                  <Campo rotulo="Meta por variedade (ha)" value={metaTxt} onChangeText={(v) => { setMetaTxt(v); const n = lerNumeroBR(v); atualizarCampo(plano.id, { metaHa: n && n > 0 ? n : null }); }} keyboardType="decimal-pad" compacto placeholder="Ex.: 16" />
                </View>
              </View>
              {totais.map((x) => {
                const c = compararComMeta(x.areaM2, plano.metaHa);
                return (
                  <View key={x.variedade} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: corDe(x.variedade) }} />
                    <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonte.regular, fontSize: 15, color: t.texto }}>{x.variedade}{x.partes > 1 ? ` (${x.partes} partes)` : ''}</Text>
                    <Text style={{ fontFamily: fonte.semi, fontSize: 15, color: t.texto, fontVariant: ['tabular-nums'] }}>{ha(x.areaM2)}</Text>
                    {c.selo !== 'sem-meta' && (
                      <View style={{ paddingHorizontal: 8, height: 24, borderRadius: 12, justifyContent: 'center', backgroundColor: c.selo === 'ok' ? t.primariaSuave : 'rgba(242,183,61,0.22)' }} accessibilityLabel={c.selo === 'ok' ? 'Dentro da meta' : 'Fora da meta'}>
                        <Text style={{ fontFamily: fonte.semi, fontSize: 12, color: c.selo === 'ok' ? t.primariaTexto : t.atencao, fontVariant: ['tabular-nums'] }}>
                          {c.selo === 'ok' ? 'na meta' : `${c.diffHa > 0 ? '+' : ''}${c.diffHa.toFixed(1).replace('.', ',')} ha`}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </Cartao>
          )}

          <Cartao style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[tipo.subtitulo, { color: t.texto }]}>Conferência de áreas</Text>
              <Dica texto="Soma das partes comparada com a área medida de cada talhão. Se houver corredor, a área dele é descontada e entra na conta. Diferença maior que 0,5% merece atenção." />
            </View>
            {conferencia.map((c) => (
              <View key={c.talhaoId} style={{ gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name={c.alerta ? 'alert-circle' : 'checkmark-circle'} size={18} color={c.alerta ? t.atencao : t.ok} />
                  <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonte.semi, fontSize: 14.5, color: t.texto }}>{nomeTalhao(c.talhaoId)}</Text>
                  <Text style={{ fontFamily: fonte.semi, fontSize: 14, color: c.alerta ? t.atencao : t.ok, fontVariant: ['tabular-nums'] }}>{formatarPercentual(c.diffPercentual)}</Text>
                </View>
                <Text style={[tipo.legenda, { color: t.textoSuave, marginLeft: 26 }]}>
                  Partes {ha(c.partesM2)} de {ha(c.medidaM2)} medidos{c.corredorEsperadoM2 > 1 ? ` · corredor ${ha(c.corredorEsperadoM2)}` : ''}
                </Text>
              </View>
            ))}
          </Cartao>

          <Text style={[tipo.legenda, { color: t.textoSuave }]}>BANDEIRINHAS · TOQUE PARA SER GUIADO ATÉ ELA</Text>
          <Cartao style={{ padding: 6 }}>
            {(verTodas ? plano.bandeiras : plano.bandeiras.slice(0, 8)).map((b, i) => {
              const d = distDe(b.coord);
              return (
                <Pressable key={b.id} onPress={() => { Haptics.selectionAsync(); setSelecionada(b.id); }} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 12, borderRadius: raio.md, backgroundColor: pressed ? t.primariaSuave : 'transparent', borderTopWidth: i ? 0.5 : 0, borderTopColor: t.linha })}>
                  <Ionicons name={b.colocada ? 'checkmark-circle' : 'flag-outline'} size={20} color={b.colocada ? t.ok : t.atencao} />
                  <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonte.regular, fontSize: 14.5, color: t.texto }}>{b.rotulo}</Text>
                  <Text style={[tipo.legenda, { color: t.textoSuave }]}>{d == null ? '' : d >= 1000 ? `${(d / 1000).toFixed(1).replace('.', ',')} km` : `${Math.round(d)} m`}</Text>
                  <Ionicons name="chevron-forward" size={15} color={t.textoSuave} />
                </Pressable>
              );
            })}
            {plano.bandeiras.length > 8 && (
              <Pressable onPress={() => setVerTodas((v) => !v)} style={{ alignItems: 'center', paddingVertical: 12 }}>
                <Text style={{ fontFamily: fonte.semi, fontSize: 14, color: t.primaria }}>{verTodas ? 'Mostrar menos' : `Ver todas (${plano.bandeiras.length})`}</Text>
              </Pressable>
            )}
            {!gps.pos && <Pressable onPress={() => gps.ligar()} style={{ alignItems: 'center', paddingVertical: 10 }}><Text style={{ fontFamily: fonte.semi, fontSize: 13.5, color: t.textoSuave }}>Ativar GPS para ver as distâncias</Text></Pressable>}
          </Cartao>

          <Cartao style={{ gap: 10 }}>
            <Text style={[tipo.legenda, { color: t.textoSuave }]}>IMPRIMIR E EXPORTAR</Text>
            <Botao titulo="Imprimir plano" tamanho="g" icone={<Ionicons name="print-outline" size={20} color={t.sobrePrimaria} />} onPress={imprimir} />
            <Botao titulo="Baixar PDF" variante="fantasma" carregando={gerandoPdf} icone={<Ionicons name="document-text-outline" size={19} color={t.primaria} />} onPress={gerarPdf} />
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Botao titulo="KML" variante="suave" onPress={() => exp('kml')} />
              <Botao titulo="GeoJSON" variante="suave" onPress={() => exp('geojson')} />
              <Botao titulo="Bandeiras (GPX)" variante="suave" onPress={() => exp('gpx')} />
              <Botao titulo="Planilha CSV" variante="suave" onPress={() => exp('csv')} />
            </View>
          </Cartao>

          {colocadas > 0 && <Botao titulo="Recomeçar as bandeirinhas" variante="suave" onPress={() => confirmar('Marcar todas as bandeirinhas como pendentes de novo?', () => atualizarCampo(plano.id, { bandeiras: plano.bandeiras.map((b) => ({ ...b, colocada: false })) }))} />}
          <Botao titulo="Excluir plano" variante="perigo" onPress={confirmarExcluir} />
        </View>
      </Animated.ScrollView>

      <PilulaMostrar visivel={mapaCheio} icone="list" rotulo="Ver plano" onPress={() => setMapaCheio(false)} />

      <FolhaBandeira
        visivel={!!bandeiraSel}
        rotulo={bandeiraSel?.rotulo ?? ''}
        colocada={!!bandeiraSel?.colocada}
        distanciaM={bandeiraSel ? distDe(bandeiraSel.coord) : null}
        ehAlvo={false}
        onGuiar={() => bandeiraSel && guiarAte(bandeiraSel.id)}
        onRota={() => { if (bandeiraSel) { irPara(bandeiraSel.coord, bandeiraSel.rotulo); setSelecionada(null); router.navigate('/rotas'); } }}
        onAlternar={() => { if (bandeiraSel) { marcar(bandeiraSel.id, !bandeiraSel.colocada); setSelecionada(null); } }}
        onFechar={() => setSelecionada(null)}
      />
    </View>
  );
}

/** Seta de direção: gira pelo menor arco, com animação curta (não dá "voltas" ao passar do norte). */
function SetaGuia({ giro }: { giro: number }) {
  const acum = useRef(giro);
  const alvo = useSharedValue(giro);
  useEffect(() => {
    const d = ((giro - acum.current + 540) % 360) - 180;
    acum.current += d;
    alvo.value = withTiming(acum.current, { duration: 220 });
  }, [giro]);
  const st = useAnimatedStyle(() => ({ transform: [{ rotate: `${alvo.value}deg` }] }));
  return <Animated.View style={st}><Ionicons name="arrow-up" size={42} color="#fff" /></Animated.View>;
}
