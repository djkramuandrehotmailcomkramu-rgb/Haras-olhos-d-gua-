import { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Campo } from './Campo';
import { Fichas } from './Fichas';
import { Botao } from './Botao';
import { fonte, tipo, useTema } from '../theme';

export const CULTURAS = ['Soja', 'Milho', 'Algodão', 'Feijão', 'Pastagem', 'Outra'];

export type DadosTalhao = { nome: string; fazenda: string; cultura: string; safra: string };

type Props = {
  visivel: boolean;
  podeTalhao: boolean;
  resumo: string;
  fazendas: string[];
  onTalhao: (d: DadosTalhao) => void;
  onMedicao: (nome: string) => void;
  onFechar: () => void;
};

const ALTURA = Dimensions.get('window').height;

/** Folha inferior: sobe com mola e fecha arrastando para baixo. */
export function FolhaSalvar({ visivel, podeTalhao, resumo, fazendas, onTalhao, onMedicao, onFechar }: Props) {
  const t = useTema();
  const [nome, setNome] = useState('');
  const [fazenda, setFazenda] = useState('');
  const [cultura, setCultura] = useState('Soja');
  const [safra, setSafra] = useState('2026/27');
  const [montada, setMontada] = useState(false);
  const ty = useSharedValue(ALTURA);
  const fundo = useSharedValue(0);
  const fecharRef = useRef(onFechar);
  fecharRef.current = onFechar;

  useEffect(() => {
    if (visivel) {
      setMontada(true);
      if (!fazenda && fazendas[0]) setFazenda(fazendas[0]);
      ty.value = ALTURA;
      ty.value = withSpring(0, { damping: 22, stiffness: 220, mass: 0.9 });
      fundo.value = withTiming(1, { duration: 220 });
    } else if (montada) {
      ty.value = withTiming(ALTURA, { duration: 240, easing: Easing.in(Easing.cubic) });
      fundo.value = withTiming(0, { duration: 220 });
      const h = setTimeout(() => setMontada(false), 250);
      return () => clearTimeout(h);
    }
  }, [visivel]);

  const arrastar = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
        onPanResponderMove: (_, g) => { ty.value = Math.max(0, g.dy); },
        onPanResponderRelease: (_, g) => {
          if (g.dy > 110 || g.vy > 0.9) fecharRef.current();
          else ty.value = withSpring(0, { damping: 22, stiffness: 240 });
        },
      }),
    [],
  );

  const estiloFolha = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }));
  const estiloFundo = useAnimatedStyle(() => ({ opacity: fundo.value }));

  return (
    <Modal visible={montada} transparent animationType="none" onRequestClose={onFechar}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' }, estiloFundo]}>
          <Pressable onPress={onFechar} style={{ flex: 1 }} />
        </Animated.View>
        <Animated.View style={[{ backgroundColor: t.fundo, borderTopLeftRadius: 30, borderTopRightRadius: 30, maxHeight: '90%' }, estiloFolha]}>
          <View {...arrastar.panHandlers} style={{ paddingTop: 10, paddingBottom: 6, alignItems: 'center' }}>
            <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: t.linha }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 8, gap: 14 }} keyboardShouldPersistTaps="handled">
            <View>
              <Text style={[tipo.titulo, { color: t.texto }]}>Salvar medição</Text>
              <Text style={{ fontFamily: fonte.semi, fontSize: 15, color: t.primaria, marginTop: 2 }}>{resumo}</Text>
            </View>
            <Campo rotulo="Nome" value={nome} onChangeText={setNome} placeholder={podeTalhao ? 'Ex.: Talhão 07 – Várzea' : 'Ex.: Cerca da divisa'} />
            {podeTalhao && (
              <>
                <Campo rotulo="Fazenda" value={fazenda} onChangeText={setFazenda} placeholder="Nome da fazenda" />
                {fazendas.length > 0 && <Fichas opcoes={fazendas} valor={fazenda} onChange={setFazenda} />}
                <Text style={[tipo.legenda, { color: t.textoSuave }]}>CULTURA</Text>
                <Fichas opcoes={CULTURAS} valor={cultura} onChange={setCultura} />
                <Campo rotulo="Safra" value={safra} onChangeText={setSafra} placeholder="2026/27" />
              </>
            )}
            <View style={{ gap: 10, marginTop: 6 }}>
              {podeTalhao && (
                <Botao
                  titulo="Salvar como talhão"
                  tamanho="g"
                  onPress={() => { onTalhao({ nome: nome.trim() || 'Talhão sem nome', fazenda: fazenda.trim() || 'Minha fazenda', cultura, safra: safra.trim() }); setNome(''); }}
                />
              )}
              <Botao
                titulo={podeTalhao ? 'Salvar só como medição' : 'Salvar medição'}
                tamanho="g"
                variante={podeTalhao ? 'suave' : 'primario'}
                onPress={() => { onMedicao(nome.trim() || 'Medição sem nome'); setNome(''); }}
              />
              <Botao titulo="Cancelar" variante="fantasma" onPress={onFechar} />
            </View>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
