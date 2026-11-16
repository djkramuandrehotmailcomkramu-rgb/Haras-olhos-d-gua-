import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Campo } from './Campo';
import { Fichas } from './Fichas';
import { Botao } from './Botao';
import { fonte, raio, tipo, useTema } from '../theme';

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

export function FolhaSalvar({ visivel, podeTalhao, resumo, fazendas, onTalhao, onMedicao, onFechar }: Props) {
  const t = useTema();
  const [nome, setNome] = useState('');
  const [fazenda, setFazenda] = useState('');
  const [cultura, setCultura] = useState('Soja');
  const [safra, setSafra] = useState('2026/27');

  useEffect(() => {
    if (visivel && !fazenda && fazendas[0]) setFazenda(fazendas[0]);
  }, [visivel]);

  return (
    <Modal visible={visivel} transparent animationType="slide" onRequestClose={onFechar}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable onPress={onFechar} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' }} />
        <View style={{ backgroundColor: t.fundo, borderTopLeftRadius: 30, borderTopRightRadius: 30, maxHeight: '88%' }}>
          <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: t.linha, marginTop: 10 }} />
          <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
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
                  onPress={() => {
                    onTalhao({ nome: nome.trim() || 'Talhão sem nome', fazenda: fazenda.trim() || 'Minha fazenda', cultura, safra: safra.trim() });
                    setNome('');
                  }}
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
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
