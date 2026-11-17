import { useMemo, useState } from 'react';
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
import { novoId, useDados, type PlanoCampo } from '../../store/dados';
import { usePrefs } from '../../store/prefs';
import { useToast } from '../../store/toast';
import { areaM2 } from '../../geo/medidas';
import { anguloLadoMaisLongo } from '../../geo/dividir';
import { CORES_VARIEDADE, gerarCampo, type ConfigTalhao } from '../../geo/campo';
import { formatarArea } from '../../geo/unidades';
import { fonte, raio, tipo, useTema } from '../../theme';

const CORREDORES = ['Sem corredor', '3 m', '6 m'];
const ESPACOS = ['Só nas pontas', 'A cada 100 m', 'A cada 200 m'];

export default function NovoCampo() {
  const t = useTema();
  const ins = useSafeAreaInsets();
  const { talhao: talhaoInicial } = useLocalSearchParams<{ talhao?: string }>();
  const { talhoes, salvarCampo } = useDados();
  const { camada } = usePrefs();
  const mostrar = useToast((s) => s.mostrar);

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { scrollY.value = e.contentOffset.y; });
  const [nome, setNome] = useState('Campo de sementes');
  const [config, setConfig] = useState<ConfigTalhao[]>(
    talhaoInicial ? [{ talhaoId: talhaoInicial, partes: 4, anguloGraus: null, inverter: false }] : [],
  );
  const [corredor, setCorredor] = useState(CORREDORES[0]);
  const [espaco, setEspaco] = useState(ESPACOS[0]);

  const corredorM = corredor === '3 m' ? 3 : corredor === '6 m' ? 6 : 0;
  const espacamentoM = espaco === 'A cada 100 m' ? 100 : espaco === 'A cada 200 m' ? 200 : 0;

  const alternar = (id: string) => {
    Haptics.selectionAsync();
    setConfig((c) => (c.some((x) => x.talhaoId === id) ? c.filter((x) => x.talhaoId !== id) : [...c, { talhaoId: id, partes: 4, anguloGraus: null, inverter: false }]));
  };
  const mudar = (id: string, p: Partial<ConfigTalhao>) => setConfig((c) => c.map((x) => (x.talhaoId === id ? { ...x, ...p } : x)));

  const { previa, erro } = useMemo(() => {
    try {
      return { previa: config.length ? gerarCampo(talhoes, config, corredorM, espacamentoM) : null, erro: null as string | null };
    } catch (e: any) {
      return { previa: null, erro: (e?.message as string) ?? 'Não foi possível dividir.' };
    }
  }, [talhoes, config, corredorM, espacamentoM]);

  const parcelasMapa = useMemo(
    () =>
      (previa?.partes ?? []).map((p, i) => ({
        id: `${p.talhaoId}-${p.indice}`,
        pedacos: p.pedacos,
        cor: CORES_VARIEDADE[i % CORES_VARIEDADE.length],
        rotulo: `${i + 1}`,
        sub: `${(p.areaM2 / 10000).toFixed(1).replace('.', ',')} ha`,
      })),
    [previa],
  );

  const criar = () => {
    if (!previa || previa.partes.length === 0) return;
    const plano: PlanoCampo = {
      id: novoId(), nome: nome.trim() || 'Campo de sementes', criadoEm: Date.now(), config, corredorM, espacamentoM,
      variedades: [], partes: previa.partes, bandeiras: previa.bandeiras, divisas: previa.divisas,
    };
    salvarCampo(plano);
    mostrar('Plano criado. Agora indique as variedades.', 'ok');
    router.replace(`/campo/${plano.id}`);
  };

  const totalPartes = config.reduce((s, c) => s + c.partes, 0);

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
          comando={previa ? { n: previa.partes.length * 1000 + config.length, tipo: 'ajustar', pontos: previa.partes.flatMap((p) => p.pedacos.flat()) } : null}
          onAdicionar={() => {}}
          onMover={() => {}}
          onTalhao={() => {}}
          parcelas={parcelasMapa}
          bandeiras={(previa?.bandeiras ?? []).map((b) => ({ id: b.id, coord: b.coord, estado: 'pendente' as const, rotulo: b.rotulo }))}
        />
        </Paralaxe>
        <Pressable onPress={() => router.back()} style={{ position: 'absolute', top: ins.top + 10, left: 16, width: 42, height: 42, borderRadius: 21, backgroundColor: t.cartao, alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <Ionicons name="chevron-back" size={24} color={t.texto} />
        </Pressable>
      </View>

      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} style={{ flex: 1, marginTop: -22, backgroundColor: t.fundo, borderTopLeftRadius: 26, borderTopRightRadius: 26, overscrollBehaviorY: 'contain', scrollBehavior: 'smooth' } as any} contentContainerStyle={{ padding: 18, paddingBottom: 60, gap: 14 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 14 }}>
          <View>
            <Text style={[tipo.titulo, { color: t.texto }]}>Novo campo de sementes</Text>
            <Text style={[tipo.corpo, { color: t.textoSuave }]}>Escolha os talhões e em quantas partes iguais dividir cada um.</Text>
          </View>

          <Campo rotulo="Nome do plano" value={nome} onChangeText={setNome} />

          <Text style={[tipo.legenda, { color: t.textoSuave }]}>TALHÕES</Text>
          {talhoes.length === 0 && (
            <Cartao style={{ gap: 8 }}>
              <Text style={[tipo.corpo, { color: t.textoSuave }]}>Você ainda não tem talhões. Importe o KML em Mais (Importar) ou meça no mapa.</Text>
              <Botao titulo="Ir para Mais" variante="suave" onPress={() => router.navigate('/mais')} />
            </Cartao>
          )}
          {talhoes.map((x) => {
            const cfg = config.find((c) => c.talhaoId === x.id);
            const ang = cfg ? (cfg.anguloGraus ?? anguloLadoMaisLongo(x.contorno)) : 0;
            const total = areaM2(x.contorno);
            const parte = previa?.partes.filter((p) => p.talhaoId === x.id) ?? [];
            return (
              <Cartao key={x.id} style={{ gap: 12, borderWidth: cfg ? 1.5 : 0, borderColor: t.primaria }}>
                <Pressable onPress={() => alternar(x.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Ionicons name={cfg ? 'checkbox' : 'square-outline'} size={26} color={cfg ? t.primaria : t.textoSuave} />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={[tipo.subtitulo, { color: t.texto }]}>{x.nome}</Text>
                    <Text style={[tipo.legenda, { color: t.textoSuave }]}>{x.fazenda} · {formatarArea(total, 'ha')}</Text>
                  </View>
                </Pressable>
                {cfg && (
                  <View style={{ gap: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ fontFamily: fonte.semi, fontSize: 15, color: t.texto }}>Número de partes</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                        <Pressable onPress={() => { Haptics.selectionAsync(); mudar(x.id, { partes: Math.max(1, cfg.partes - 1) }); }} accessibilityLabel="Menos uma parte" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.cartaoSuave, alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="remove" size={22} color={t.texto} />
                        </Pressable>
                        <Text style={{ fontFamily: fonte.negrito, fontSize: 24, color: t.primaria, minWidth: 28, textAlign: 'center', fontVariant: ['tabular-nums'] }}>{cfg.partes}</Text>
                        <Pressable onPress={() => { Haptics.selectionAsync(); mudar(x.id, { partes: Math.min(30, cfg.partes + 1) }); }} accessibilityLabel="Mais uma parte" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.cartaoSuave, alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="add" size={22} color={t.texto} />
                        </Pressable>
                      </View>
                    </View>
                    <Text style={[tipo.corpo, { color: t.textoSuave }]}>
                      {parte.length ? `Cada parte com ≈ ${(parte[0].areaM2 / 10000).toFixed(2).replace('.', ',')} ha` : ''}
                    </Text>
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

          <Text style={[tipo.legenda, { color: t.textoSuave }]}>CORREDOR ENTRE AS PARTES (EVITA MISTURAR SEMENTE)</Text>
          <Fichas opcoes={CORREDORES} valor={corredor} onChange={setCorredor} />
          {corredorM > 0 && <Text style={[tipo.corpo, { color: t.textoSuave }]}>O corredor é descontado da área: as partes ficam um pouco menores.</Text>}

          <Text style={[tipo.legenda, { color: t.textoSuave }]}>BANDEIRINHAS AO LONGO DA DIVISA</Text>
          <Fichas opcoes={ESPACOS} valor={espaco} onChange={setEspaco} />

          {erro && <Text style={[tipo.corpo, { color: t.perigo }]}>{erro}</Text>}

          {previa && (
            <Cartao style={{ gap: 4 }}>
              <Text style={{ fontFamily: fonte.semi, fontSize: 15, color: t.texto }}>{totalPartes} partes · {previa.divisas.length} divisas · {previa.bandeiras.length} bandeirinhas</Text>
              <Text style={[tipo.corpo, { color: t.textoSuave }]}>
                Área total: {(previa.partes.reduce((s, p) => s + p.areaM2, 0) / 10000).toFixed(2).replace('.', ',')} ha
              </Text>
            </Cartao>
          )}

          <Botao titulo="Criar plano" tamanho="g" desabilitado={!previa || previa.partes.length === 0} icone={<Ionicons name="checkmark" size={21} color={t.sobrePrimaria} />} onPress={criar} />
        </View>
      </Animated.ScrollView>
    </View>
  );
}
