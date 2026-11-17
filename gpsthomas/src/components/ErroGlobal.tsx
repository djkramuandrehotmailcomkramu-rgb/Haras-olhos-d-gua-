import { Component, ReactNode } from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Botao } from './Botao';
import { gerarBackup, nomeArquivoBackup } from '../io/backup';
import { entregarArquivo } from '../io/arquivos';
import { fonte, tipo, useTema } from '../theme';

function TelaErro({ erro, onTentar }: { erro: Error; onTentar: () => void }) {
  const t = useTema();
  const baixar = () => {
    try { entregarArquivo(nomeArquivoBackup(), JSON.stringify(gerarBackup(), null, 2), 'application/json'); } catch {}
  };
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.fundo }} contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 16 }}>
      <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: 'rgba(214,69,69,0.14)', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="alert-circle" size={46} color={t.perigo} />
      </View>
      <Text style={[tipo.titulo, { color: t.texto, textAlign: 'center' }]}>Algo deu errado</Text>
      <Text style={[tipo.corpo, { color: t.textoSuave, textAlign: 'center', maxWidth: 340 }]}>
        O aplicativo encontrou um problema inesperado. Seus dados continuam salvos neste aparelho. Você pode tentar de novo ou baixar um backup antes de recarregar.
      </Text>
      <View style={{ alignSelf: 'stretch', gap: 10, maxWidth: 420, width: '100%' }}>
        <Botao titulo="Tentar de novo" tamanho="g" onPress={onTentar} />
        {Platform.OS === 'web' && <Botao titulo="Recarregar o aplicativo" variante="suave" onPress={() => window.location.reload()} />}
        <Botao titulo="Baixar backup dos meus dados" variante="suave" onPress={baixar} />
      </View>
      <Text selectable style={{ fontFamily: fonte.regular, fontSize: 11.5, color: t.textoSuave, textAlign: 'center', maxWidth: 340 }}>{erro.message}</Text>
    </ScrollView>
  );
}

/** Evita a tela em branco: mostra uma tela amigável com opção de backup. */
export class ErroGlobal extends Component<{ children: ReactNode }, { erro: Error | null }> {
  state = { erro: null as Error | null };
  static getDerivedStateFromError(erro: Error) { return { erro }; }
  componentDidCatch(erro: Error) {
    try { localStorage.setItem('gpsthomas-ultimo-erro', JSON.stringify({ mensagem: erro.message, quando: new Date().toISOString() })); } catch {}
  }
  render() {
    if (this.state.erro) return <TelaErro erro={this.state.erro} onTentar={() => this.setState({ erro: null })} />;
    return this.props.children;
  }
}
