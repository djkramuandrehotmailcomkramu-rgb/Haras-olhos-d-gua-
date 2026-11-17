import { useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { Paralaxe } from '../../components/Paralaxe';
import { Revelar } from '../../components/Revelar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapaInterativo } from '../../components/MapaInterativo';
import { Cartao } from '../../components/Cartao';
import { Botao } from '../../components/Botao';
import { Campo } from '../../components/Campo';
import { Fichas } from '../../components/Fichas';
import { Dica } from '../../components/Dica';
import { novoId, useDados, type BandeiraCampo, type ParteCampo, type PlanoCampo } from '../../store/dados';
import { usePrefs } from '../../store/prefs';
import { useToast } from '../../store/toast';
import { areaM2, comprimentoM } from '../../geo/medidas';
import { anguloLadoMaisLongo } from '../../geo/dividir';
import { CORES_VARIEDADE, conferirManual, fatorCalibracao, gerarCampo, type ConfigTalhao } from '../../geo/campo';
import { formatarNumeroBR, lerNumeroBR, paraCampoBR } from '../../geo/numero';
import { formatarArea, formatarHa, formatarHaSemUnidade } from '../../geo/unidades';
import { fonte, raio, tipo, useTema } from '../../theme';

const CORREDORES = ['Sem corredor', '3 m', '6 m'];
const ESPACOS = ['Só nas pontas', 'A cada 100 m', 'A cada 200 m'];
const MODOS = ['Partes iguais', 'Digitar hectares'];

type Digitado = { textos: string[]; informada: string };

const rotuloCorredor = (m: number) => (m === 3 ? '3 m' : m === 6 ? '6 m' : CORREDORES[0]);
const rotuloEspaco = (m: number) => (m === 100 ? ESPACOS[1] : m === 200 ? ESPACOS[2] : ESPACOS[0]);

export default function NovoCampo() {
  const t = useTema();
  const ins = useSafeAreaInsets();
  const { talhao: talhaoInicial, editar } = useLocalSearchParams<{ talhao?: string; editar?: string }>();
  const { talhoes, salvarCampo } = useDados();
  const planoEditado = useDados((s) => (editar ? s.campos.find((c) => c.id === editar) : undefined));
  const { camada } = usePrefs();
  const mostrar = useToast((s) => s.mostrar);

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { scrollY.value = e.contentOffset.y; });

  const [nome, setNome] = useState(planoEditado?.nome ?? 'Campo de sementes');
  const [config, setConfig] = useState<ConfigTalhao[]>(() =>
    planoEditado
      ? planoEditado.config.map((c) => ({ ...c }))
      : talhaoInicial ? [{ talhaoId: talhaoInicial, partes: 4, anguloGraus: null, inverter: false, modo: 'iguais' }] : [],
  );
  const [dig, setDig] = useState<Record<string, Digitado>>(() => {
    const r: Record<string, Digitado> = {};
    planoEditado?.config.forEach((c) => {
      if (c.modo === 'manual') r[c.talhaoId] = { textos: (c.areasHa ?? []).map((a) => paraCampoBR(a)), informada: c.areaInformadaHa ? paraCampoBR(c.areaInformadaHa) : '' };
    });
    return r;
  });
  const [corredor, setCorredor] = useState(rotuloCorredor(planoEditado?.corredorM ?? 0));
  const [espaco, setEspaco] = useState(rotuloEspaco(planoEditado?.espacamentoM ?? 0));
  const [haCada, setHaCada] = useState('16');
  const ultimaPrevia = useRef<ReturnType<typeof gerarCampo> | null>(null);

  const corredorM = corredor === '3 m' ? 3 : corredor === '6 m' ? 6 : 0;
  const espacamentoM = espaco === 'A cada 100 m' ? 100 : espaco === 'A cada 200 m' ? 200 : 0;

  const talhaoDe = (id: string) => talhoes.find((x) => x.id === id);
  const parseTextos = (c: ConfigTalhao) => (dig[c.talhaoId]?.textos ?? []).slice(0, Math.max(0, c.partes - 1)).map((s) => lerNumeroBR(s) ?? NaN);

  /** Configuração com os números digitados já convertidos. */
  const configEfetiva = useMemo<ConfigTalhao[]>(
    () => config.map((c) => (c.modo === 'manual' ? { ...c, areasHa: parseTextos(c), areaInformadaHa: lerNumeroBR(dig[c.talhaoId]?.informada ?? '') } : c)),
    [config, dig],
  );

  const alternar = (id: string) => {
    Haptics.selectionAsync();
    setConfig((c) => (c.some((x) => x.talhaoId === id) ? c.filter((x) => x.talhaoId !== id) : [...c, { talhaoId: id, partes: 4, anguloGraus: null, inverter: false, modo: 'iguais' }]));
  };
  const mudar = (id: string, p: Partial<ConfigTalhao>) => setConfig((c) => c.map((x) => (x.talhaoId === id ? { ...x, ...p } : x)));

  const igualar = (id: string, partes: number) => {
    const tl = talhaoDe(id);
    if (!tl) return [];
    const cada = Math.round((areaM2(tl.contorno) / 10000 / partes) * 100) / 100;
    return Array.from({ length: Math.max(0, partes - 1) }, () => paraCampoBR(cada, 2));
  };

  const trocarModo = (id: string, modo: 'iguais' | 'manual') => {
    const cfg = config.find((c) => c.talhaoId === id);
    if (!cfg) return;
    Haptics.selectionAsync();
    mudar(id, { modo });
    if (modo === 'manual' && !dig[id]) setDig((d) => ({ ...d, [id]: { textos: igualar(id, cfg.partes), informada: '' } }));
  };

  const mudarPartes = (id: string, delta: number) => {
    const cfg = config.find((c) => c.talhaoId === id);
    if (!cfg) return;
    const n = Math.min(30, Math.max(1, cfg.partes + delta));
    Haptics.selectionAsync();
    mudar(id, { partes: n });
    setDig((d) => {
      const cur = d[id];
      if (!cur) return d;
      const tx = cur.textos.slice(0, Math.max(0, n - 1));
      while (tx.length < n - 1) tx.push(tx[tx.length - 1] ?? '');
      return { ...d, [id]: { ...cur, textos: tx } };
    });
  };

  const { previa, erro } = useMemo(() => {
    try {
      return { previa: configEfetiva.length ? gerarCampo(talhoes, configEfetiva, corredorM, espacamentoM) : null, erro: null as string | null };
    } catch (e: any) {
      return { previa: null, erro: (e?.message as string) ?? 'Não foi possível dividir.' };
    }
  }, [talhoes, configEfetiva, corredorM, espacamentoM]);
  if (previa) ultimaPrevia.current = previa;
  const mostrada = previa ?? (erro ? ultimaPrevia.current : null);

  const parcelasMapa = useMemo(
    () =>
      (mostrada?.partes ?? []).map((p, i) => ({
        id: `${p.talhaoId}-${p.indice}`,
        pedacos: p.pedacos,
        cor: CORES_VARIEDADE[i % CORES_VARIEDADE.length],
        rotulo: `${i + 1}`,
        sub: formatarHa(p.areaM2, 1),
      })),
    [mostrada],
  );

  const criar = () => {
    if (!previa || previa.partes.length === 0) return;
    let partes: ParteCampo[] = previa.partes;
    let bandeiras: BandeiraCampo[] = previa.bandeiras;
    let mantidas = 0;
    if (planoEditado) {
      // mantém variedades por talhão+índice; as partes novas herdam a última variedade usada
      const ultima = planoEditado.partes[planoEditado.partes.length - 1]?.variedade ?? '';
      partes = previa.partes.map((p) => ({ ...p, variedade: planoEditado.partes.find((q) => q.talhaoId === p.talhaoId && q.indice === p.indice)?.variedade ?? ultima }));
      // mantém "colocada" para bandeiras que continuam no mesmo lugar (±1,5 m)
      const colocadas = planoEditado.bandeiras.filter((b) => b.colocada);
      bandeiras = previa.bandeiras.map((b) => {
        const igual = colocadas.some((c) => comprimentoM([c.coord, b.coord]) <= 1.5);
        if (igual) mantidas += 1;
        return igual ? { ...b, colocada: true } : b;
      });
    }
    const plano: PlanoCampo = {
      id: planoEditado?.id ?? novoId(), nome: nome.trim() || 'Campo de sementes', criadoEm: planoEditado?.criadoEm ?? Date.now(),
      config: configEfetiva.map((c) => (c.modo === 'manual' ? { ...c, areasHa: c.areasHa } : { ...c, areasHa: undefined, areaInformadaHa: undefined })),
      corredorM, espacamentoM, variedades: planoEditado?.variedades ?? [], metaHa: planoEditado?.metaHa ?? null,
      partes, bandeiras, divisas: previa.divisas,
    };
    salvarCampo(plano);
    mostrar(planoEditado ? `Plano atualizado${mantidas ? ` (${mantidas} bandeirinhas já colocadas mantidas)` : ''}` : 'Plano criado. Agora indique as variedades.', 'ok');
    router.replace(`/campo/${plano.id}`);
  };

  const totalPartes = configEfetiva.reduce((s, c) => s + c.partes, 0);

  return (
    <View style={{ flex: 1, backgroundColor: t.fundo }}>
      <View style={{ height: 270 + ins.top, overflow: 'hidden' }}>
        <Paralaxe y={scrollY} style={{ flex: 1 }}>
          <MapaInterativo
            talhoes={talhoes.filter((x) => !config.some((c) => c.talhaoId === x.id)).map((x) => ({ id: x.id, nome: x.nome, rotulo: '', contorno: x.contorno }))}
            rascunho={[]}
            poligono
            camada={camada}
            posicao={null}
            comando={mostrada ? { n: mostrada.partes.length * 1000 + config.length, tipo: 'ajustar', pontos: mostrada.partes.flatMap((p) => p.pedacos.flat()) } : null}
            onAdicionar={() => {}}
            onMover={() => {}}
            onTalhao={() => {}}
            parcelas={parcelasMapa}
            bandeiras={(mostrada?.bandeiras ?? []).map((b) => ({ id: b.id, coord: b.coord, estado: 'pendente' as const, rotulo: b.rotulo }))}
          />
        </Paralaxe>
        <Pressable onPress={() => router.back()} accessibilityLabel="Voltar" style={{ position: 'absolute', top: ins.top + 10, left: 16, width: 44, height: 44, borderRadius: 22, backgroundColor: t.cartao, alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <Ionicons name="chevron-back" size={24} color={t.texto} />
        </Pressable>
      </View>

      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} style={{ flex: 1, marginTop: -22, backgroundColor: t.fundo, borderTopLeftRadius: 26, borderTopRightRadius: 26, overscrollBehaviorY: 'contain', scrollBehavior: 'smooth' } as any} contentContainerStyle={{ padding: 18, paddingBottom: 80, gap: 14 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={{ gap: 14 }}>
          <View>
            <Text style={[tipo.titulo, { color: t.texto }]}>{planoEditado ? 'Ajustar hectares e divisas' : 'Novo campo de sementes'}</Text>
            <Text style={[tipo.corpo, { color: t.textoSuave }]}>Escolha os talhões e divida em partes iguais ou digite os hectares de cada parte.</Text>
          </View>

          {planoEditado && planoEditado.bandeiras.some((b) => b.colocada) && (
            <Cartao style={{ flexDirection: 'row', gap: 10, backgroundColor: 'rgba(242,183,61,0.16)' }}>
              <Ionicons name="information-circle" size={20} color={t.atencao} />
              <Text style={[tipo.corpo, { color: t.texto, flex: 1 }]}>As bandeirinhas já colocadas que continuarem no mesmo lugar (até 1,5 m) permanecem marcadas. As demais voltam a pendentes.</Text>
            </Cartao>
          )}

          <Campo rotulo="Nome do plano" value={nome} onChangeText={setNome} />

          <Text style={[tipo.legenda, { color: t.textoSuave }]}>TALHÕES</Text>
          {talhoes.length === 0 && (
            <Cartao style={{ gap: 8 }}>
              <Text style={[tipo.corpo, { color: t.textoSuave }]}>Você ainda não tem talhões. Importe o KML em Mais (Importar) ou meça no mapa.</Text>
              <Botao titulo="Ir para Mais" variante="suave" onPress={() => router.navigate('/mais')} />
            </Cartao>
          )}
          {talhoes.map((x) => {
            const cfg = configEfetiva.find((c) => c.talhaoId === x.id);
            const ang = cfg ? (cfg.anguloGraus ?? anguloLadoMaisLongo(x.contorno)) : 0;
            const total = areaM2(x.contorno);
            const parte = mostrada?.partes.filter((p) => p.talhaoId === x.id) ?? [];
            const manual = cfg?.modo === 'manual';
            const d = dig[x.id];
            const conf = manual && cfg ? conferirManual(total, parseTextos(cfg), lerNumeroBR(d?.informada ?? '')) : null;
            const k = fatorCalibracao(total, lerNumeroBR(d?.informada ?? ''));
            return (
              <Cartao key={x.id} style={{ gap: 12, borderWidth: cfg ? 1.5 : 0, borderColor: t.primaria }}>
                <Pressable onPress={() => alternar(x.id)} accessibilityRole="checkbox" aria-checked={!!cfg} accessibilityLabel={`${x.nome}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}>
                  <Ionicons name={cfg ? 'checkbox' : 'square-outline'} size={26} color={cfg ? t.primaria : t.textoSuave} />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={[tipo.subtitulo, { color: t.texto }]}>{x.nome}</Text>
                    <Text style={[tipo.legenda, { color: t.textoSuave }]}>{x.fazenda} · {formatarArea(total, 'ha')}</Text>
                  </View>
                </Pressable>
                {cfg && (
                  <View style={{ gap: 12 }}>
                    <Fichas opcoes={MODOS} valor={manual ? MODOS[1] : MODOS[0]} onChange={(v) => trocarModo(x.id, v === MODOS[1] ? 'manual' : 'iguais')} />

                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ fontFamily: fonte.semi, fontSize: 15, color: t.texto }}>Número de partes</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                        <Pressable onPress={() => mudarPartes(x.id, -1)} accessibilityLabel="Menos uma parte" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.cartaoSuave, alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="remove" size={22} color={t.texto} />
                        </Pressable>
                        <Text style={{ fontFamily: fonte.negrito, fontSize: 24, color: t.primaria, minWidth: 28, textAlign: 'center', fontVariant: ['tabular-nums'] }}>{cfg.partes}</Text>
                        <Pressable onPress={() => mudarPartes(x.id, +1)} accessibilityLabel="Mais uma parte" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.cartaoSuave, alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="add" size={22} color={t.texto} />
                        </Pressable>
                      </View>
                    </View>

                    {!manual && (
                      <Text style={[tipo.corpo, { color: t.textoSuave }]}>{parte.length ? `Cada parte com ≈ ${formatarHa(parte[0].areaM2)}` : ''}</Text>
                    )}

                    {manual && d && conf && (
                      <View style={{ gap: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[tipo.legenda, { color: t.textoSuave }]}>HECTARES DE CADA PARTE</Text>
                          <Dica texto="Digite os hectares de cada parte (pode usar vírgula: 16,5). A última parte recebe automaticamente o que sobrar do talhão." />
                        </View>
                        {d.textos.map((txt, i) => {
                          const v = lerNumeroBR(txt);
                          const invalido = txt.trim() !== '' && (v == null || v <= 0);
                          return (
                            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: CORES_VARIEDADE[(configEfetiva.slice(0, configEfetiva.indexOf(cfg)).reduce((s, c) => s + c.partes, 0) + i) % CORES_VARIEDADE.length] }} />
                              <Text style={{ fontFamily: fonte.semi, fontSize: 14.5, color: t.texto, width: 62 }}>Parte {i + 1}</Text>
                              <View style={{ flex: 1 }}>
                                <Campo
                                  rotulo=""
                                  value={txt}
                                  onChangeText={(s) => setDig((cur) => ({ ...cur, [x.id]: { ...cur[x.id], textos: cur[x.id].textos.map((q, j) => (j === i ? s : q)) } }))}
                                  keyboardType="decimal-pad"
                                  placeholder="ha"
                                  accessibilityLabel={`Hectares da parte ${i + 1} de ${x.nome}`}
                                  style={invalido ? { borderWidth: 1.5, borderColor: t.perigo } : undefined}
                                  compacto
                                />
                              </View>
                              <Text style={{ fontFamily: fonte.semi, fontSize: 14, color: t.textoSuave }}>ha</Text>
                            </View>
                          );
                        })}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, opacity: conf.ok ? 1 : 0.6 }}>
                          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: CORES_VARIEDADE[(configEfetiva.slice(0, configEfetiva.indexOf(cfg)).reduce((s, c) => s + c.partes, 0) + cfg.partes - 1) % CORES_VARIEDADE.length] }} />
                          <Text style={{ fontFamily: fonte.semi, fontSize: 14.5, color: t.texto, flex: 1 }}>Parte {cfg.partes} (o que sobra)</Text>
                          <Text style={{ fontFamily: fonte.negrito, fontSize: 16, color: conf.ok ? t.primaria : t.perigo, fontVariant: ['tabular-nums'] }}>
                            {formatarNumeroBR(Math.max(0, conf.restoHa))} ha
                          </Text>
                        </View>
                        <Text style={[tipo.corpo, { color: conf.ok ? t.textoSuave : t.perigo }]}>
                          {conf.ok
                            ? `Soma das partes digitadas: ${formatarNumeroBR(conf.somaHa)} ha de ${formatarHaSemUnidade(total)} ha medidos${k !== 1 ? ` (ajustado ×${formatarNumeroBR(k, 4)})` : ''}.`
                            : conf.erro}
                        </Text>

                        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
                          <View style={{ width: 110 }}>
                            <Campo rotulo="Preencher com" value={haCada} onChangeText={setHaCada} keyboardType="decimal-pad" compacto accessibilityLabel="Hectares para preencher todas as partes" />
                          </View>
                          <Botao titulo="Aplicar a todas" variante="suave" onPress={() => { const v = lerNumeroBR(haCada); if (v && v > 0) setDig((cur) => ({ ...cur, [x.id]: { ...cur[x.id], textos: Array.from({ length: cfg.partes - 1 }, () => paraCampoBR(v)) } })); else mostrar('Digite um número de hectares maior que zero.', 'erro'); }} />
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <Botao titulo="Igualar" variante="fantasma" onPress={() => setDig((cur) => ({ ...cur, [x.id]: { ...cur[x.id], textos: igualar(x.id, cfg.partes) } }))} />
                          <Botao titulo="Limpar" variante="fantasma" onPress={() => setDig((cur) => ({ ...cur, [x.id]: { ...cur[x.id], textos: cur[x.id].textos.map(() => '') } }))} />
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[tipo.legenda, { color: t.textoSuave }]}>ÁREA INFORMADA DO TALHÃO (OPCIONAL)</Text>
                          <Dica texto={`O app mediu ${formatarHaSemUnidade(total)} ha pelo contorno do KML. Se você sabe que o talhão tem outro valor (ex.: 92 ha), informe aqui e os hectares digitados serão ajustados proporcionalmente. É uma aproximação: as divisas continuam seguindo o contorno medido.`} />
                        </View>
                        <Campo rotulo="" value={d.informada} onChangeText={(s) => setDig((cur) => ({ ...cur, [x.id]: { ...cur[x.id], informada: s } }))} keyboardType="decimal-pad" placeholder={`Medido: ${formatarHaSemUnidade(total)}`} compacto accessibilityLabel={`Área informada de ${x.nome} em hectares`} />
                      </View>
                    )}

                    <Text style={[tipo.legenda, { color: t.textoSuave }]}>DIREÇÃO DAS DIVISAS · {Math.round(ang)}° {cfg.anguloGraus == null ? '(acompanha o lado mais longo)' : '(manual)'}</Text>
                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                      <Botao titulo="Auto" variante={cfg.anguloGraus == null ? 'primario' : 'suave'} onPress={() => mudar(x.id, { anguloGraus: null })} />
                      <Botao titulo="−10°" variante="suave" onPress={() => mudar(x.id, { anguloGraus: (((cfg.anguloGraus ?? ang) - 10) % 180 + 180) % 180 })} />
                      <Botao titulo="+10°" variante="suave" onPress={() => mudar(x.id, { anguloGraus: (((cfg.anguloGraus ?? ang) + 10) % 180 + 180) % 180 })} />
                      <Botao titulo="Perpendicular" variante="suave" onPress={() => mudar(x.id, { anguloGraus: ((cfg.anguloGraus ?? ang) + 90) % 180 })} />
                      <Botao titulo={cfg.inverter ? 'Começar do outro lado ✓' : 'Começar do outro lado'} variante={cfg.inverter ? 'primario' : 'suave'} onPress={() => mudar(x.id, { inverter: !cfg.inverter })} />
                    </View>
                  </View>
                )}
              </Cartao>
            );
          })}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[tipo.legenda, { color: t.textoSuave }]}>CORREDOR ENTRE AS PARTES</Text>
            <Dica texto="Faixa vazia entre uma variedade e outra para não misturar semente. Ela é descontada da área, então as partes ficam um pouco menores." />
          </View>
          <Fichas opcoes={CORREDORES} valor={corredor} onChange={setCorredor} />

          <Text style={[tipo.legenda, { color: t.textoSuave }]}>BANDEIRINHAS AO LONGO DA DIVISA</Text>
          <Fichas opcoes={ESPACOS} valor={espaco} onChange={setEspaco} />

          {erro && (
            <Cartao style={{ flexDirection: 'row', gap: 10, backgroundColor: 'rgba(214,69,69,0.12)' }}>
              <Ionicons name="alert-circle" size={20} color={t.perigo} />
              <Text style={[tipo.corpo, { color: t.perigo, flex: 1 }]}>{erro}</Text>
            </Cartao>
          )}

          {mostrada && (
            <Revelar>
              <Cartao style={{ gap: 6 }}>
                <Text style={{ fontFamily: fonte.semi, fontSize: 15, color: t.texto }}>{totalPartes} partes · {mostrada.divisas.length} divisas · {mostrada.bandeiras.length} bandeirinhas</Text>
                {configEfetiva.map((c) => {
                  const ps = mostrada.partes.filter((p) => p.talhaoId === c.talhaoId);
                  return (
                    <Text key={c.talhaoId} style={[tipo.corpo, { color: t.textoSuave }]}>
                      {talhaoDe(c.talhaoId)?.nome}: {ps.map((p) => formatarHaSemUnidade(p.areaM2)).join(' · ')} ha
                    </Text>
                  );
                })}
                <Text style={[tipo.corpo, { color: t.textoSuave }]}>Área total: {formatarHa(mostrada.partes.reduce((s, p) => s + p.areaM2, 0))}</Text>
              </Cartao>
            </Revelar>
          )}

          <Botao titulo={planoEditado ? 'Salvar alterações' : 'Criar plano'} tamanho="g" desabilitado={!previa || previa.partes.length === 0} icone={<Ionicons name="checkmark" size={21} color={t.sobrePrimaria} />} onPress={criar} />
        </View>
      </Animated.ScrollView>
    </View>
  );
}
