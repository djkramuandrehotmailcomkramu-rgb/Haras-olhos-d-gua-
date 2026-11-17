import { ReactNode, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { VERSAO } from '../versao';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Cartao } from '../components/Cartao';
import { Botao } from '../components/Botao';
import { Revelar } from '../components/Revelar';
import { useDados } from '../store/dados';
import { usePrefs } from '../store/prefs';
import { useSistema } from '../store/sistema';
import { useToast } from '../store/toast';
import { gerarBackup, nomeArquivoBackup } from '../io/backup';
import { entregarArquivo } from '../io/arquivos';
import { fonte, raio, tipo, useTema } from '../theme';

function Secao({ titulo, icone, children }: { titulo: string; icone: keyof typeof Ionicons.glyphMap; children: ReactNode }) {
  const t = useTema();
  const [aberta, setAberta] = useState(false);
  return (
    <Cartao style={{ padding: 0, overflow: 'hidden' }}>
      <Pressable onPress={() => { Haptics.selectionAsync(); setAberta((v) => !v); }} accessibilityRole="button" accessibilityState={{ expanded: aberta }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, minHeight: 56 }}>
        <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: t.primariaSuave, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icone} size={19} color={t.primaria} />
        </View>
        <Text style={{ flex: 1, fontFamily: fonte.semi, fontSize: 16, color: t.texto }}>{titulo}</Text>
        <Ionicons name={aberta ? 'chevron-up' : 'chevron-down'} size={18} color={t.textoSuave} />
      </Pressable>
      {aberta && <Animated.View entering={FadeIn.duration(200)} style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 8 }}>{children}</Animated.View>}
    </Cartao>
  );
}

const P = ({ children }: { children: ReactNode }) => {
  const t = useTema();
  return <Text style={{ fontFamily: fonte.regular, fontSize: 14.5, lineHeight: 21, color: t.texto }}>{children}</Text>;
};
const Item = ({ n, children }: { n: string; children: ReactNode }) => {
  const t = useTema();
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <Text style={{ fontFamily: fonte.negrito, fontSize: 14.5, color: t.primaria, width: 18 }}>{n}</Text>
      <Text style={{ flex: 1, fontFamily: fonte.regular, fontSize: 14.5, lineHeight: 21, color: t.texto }}>{children}</Text>
    </View>
  );
};

export default function Ajuda() {
  const t = useTema();
  const ins = useSafeAreaInsets();
  const mostrar = useToast((s) => s.mostrar);
  const { talhoes, medicoes, campos, viagens } = useDados();
  const marcarBackup = usePrefs((s) => s.marcarBackup);
  const { armazenamentoPersistente, novaVersao } = useSistema();
  const versao = VERSAO;

  const verificar = async () => {
    if (Platform.OS !== 'web') { mostrar('Você está na versão mais recente.', 'ok'); return; }
    try {
      const reg = (window as any).__gtReg as ServiceWorkerRegistration | undefined;
      await reg?.update();
      mostrar(reg?.waiting || novaVersao ? 'Há uma nova versão: toque em Atualizar no aviso.' : 'Você está na versão mais recente.', 'ok');
    } catch { mostrar('Não foi possível verificar agora (sem internet?).', 'erro'); }
  };

  const baixar = () => { entregarArquivo(nomeArquivoBackup(), JSON.stringify(gerarBackup(), null, 2), 'application/json'); marcarBackup(); mostrar('Backup baixado', 'ok'); };

  return (
    <View style={{ flex: 1, backgroundColor: t.fundo }}>
      <ScrollView contentContainerStyle={{ paddingTop: ins.top + 12, paddingBottom: 60, paddingHorizontal: 18, gap: 12 }} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Voltar" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.cartao, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="chevron-back" size={24} color={t.texto} />
        </Pressable>

        <Revelar>
          <View style={{ alignItems: 'center', gap: 6, paddingVertical: 8 }}>
            <Image source={require('../../assets/icon.png')} style={{ width: 92, height: 92, borderRadius: 22 }} accessibilityLabel="Ícone do GPSThomas" />
            <Text style={[tipo.titulo, { color: t.texto }]}>GPSThomas</Text>
            <Text style={[tipo.corpo, { color: t.textoSuave }]}>Versão {versao}</Text>
            <View style={{ marginTop: 6 }}><Botao titulo="Verificar atualização" variante="suave" onPress={verificar} /></View>
          </View>
        </Revelar>

        <Text style={[tipo.legenda, { color: t.textoSuave, marginLeft: 6 }]}>COMO USAR</Text>
        <Secao titulo="Medir uma área" icone="walk">
          <Item n="1">Abra a aba <Text style={{ fontFamily: fonte.semi }}>Medir</Text> e escolha o modo: <Text style={{ fontFamily: fonte.semi }}>Caminhar</Text> (o GPS grava o contorno enquanto você anda), <Text style={{ fontFamily: fonte.semi }}>Marcar</Text> (toque nos cantos no mapa) ou <Text style={{ fontFamily: fonte.semi }}>Distância</Text> (linha aberta).</Item>
          <Item n="2">A área, o perímetro e a precisão do GPS aparecem no topo. Toque no valor para trocar a unidade (hectare, alqueires, m²).</Item>
          <Item n="3">Arraste os pontos para ajustar. Use desfazer e refazer na lateral. Toque em <Text style={{ fontFamily: fonte.semi }}>Salvar</Text> e escolha talhão ou só medição.</Item>
          <Item n="4">Quer ver o mapa limpo? Arraste a alça do painel para baixo.</Item>
        </Secao>
        <Secao titulo="Importar o KML da fazenda" icone="download">
          <Item n="1">Em <Text style={{ fontFamily: fonte.semi }}>Mais</Text>, escreva o nome da fazenda e toque em Importar. Aceita KML, KMZ, GeoJSON e GPX.</Item>
          <Item n="2">O app mostra a área que mediu em cada talhão. Ela vem do desenho do contorno, então pode diferir um pouco do número que você tem anotado.</Item>
        </Secao>
        <Secao titulo="Campo de sementes" icone="flag">
          <Item n="1">Em <Text style={{ fontFamily: fonte.semi }}>Talhões</Text>, toque em Novo campo de sementes e marque os talhões.</Item>
          <Item n="2">Para cada talhão, escolha <Text style={{ fontFamily: fonte.semi }}>Partes iguais</Text> ou <Text style={{ fontFamily: fonte.semi }}>Digitar hectares</Text> (a última parte fica com o que sobra).</Item>
          <Item n="3">Crie o plano, cole as variedades (uma por linha) e, se quiser, defina a meta por variedade (ex.: 16 ha).</Item>
          <Item n="4">Toque em <Text style={{ fontFamily: fonte.semi }}>Marcar no campo</Text> (ou numa bandeirinha) para ser guiado até cada ponto das divisas. Ao chegar, o celular vibra; cravar a bandeirinha e tocar em "Bandeira colocada".</Item>
          <Item n="5">Gere o PDF do plano para imprimir ou exporte KML/GPX para a máquina.</Item>
        </Secao>
        <Secao titulo="Rotas e navegação" icone="navigate">
          <P>Na aba Rotas, busque um endereço, cidade ou rodovia, escolha entre até 3 rotas e inicie. A voz avisa as curvas, o app recalcula se você sair do caminho e mostra a velocidade e o limite da via quando existe. Dentro da lavoura, use o guia das bandeirinhas (vai em linha reta até o ponto).</P>
        </Secao>

        <Text style={[tipo.legenda, { color: t.textoSuave, marginLeft: 6, marginTop: 6 }]}>BOM SABER</Text>
        <Secao titulo="Precisão do GPS" icone="locate">
          <P>O GPS do celular costuma errar de 3 a 10 metros, e mais sob nuvens pesadas, perto de construções ou no início, antes de "travar" nos satélites. Em uma faixa de 400 m, 5 m de erro mudam a área em cerca de 1%.</P>
          <P>Para medir, espere a precisão ficar verde (até 10 m). Para precisão de centímetros é preciso um receptor GNSS/RTK externo, que o aplicativo web não suporta.</P>
        </Secao>
        <Secao titulo="Tela ligada e segundo plano" icone="phone-portrait">
          <P>Na versão web (PWA), o navegador pára de enviar o GPS quando a tela apaga. Mantenha a tela ligada durante a caminhada, a navegação e o guia das bandeirinhas. O GPS em segundo plano virá com o aplicativo Android (APK).</P>
        </Secao>
        <Secao titulo="Privacidade e serviços de terceiros" icone="shield-checkmark">
          <P>Seus talhões, medições e planos ficam somente neste aparelho. Nada é enviado para um servidor do GPSThomas.</P>
          <P>Alguns recursos usam serviços abertos de terceiros: imagens de satélite (Esri) e mapa de ruas (OpenStreetMap); a busca de endereços envia o texto digitado ao Nominatim; o cálculo de rotas envia a origem e o destino ao servidor OSRM. A sua localização é usada só dentro do aparelho, exceto quando você traça uma rota (a origem vai ao OSRM).</P>
          <P>Esses servidores públicos gratuitos são para uso leve e podem ficar lentos ou limitar acessos. Para uso intenso, o ideal é configurar um servidor próprio ou uma chave de serviço.</P>
        </Secao>

        <Text style={[tipo.legenda, { color: t.textoSuave, marginLeft: 6, marginTop: 6 }]}>SEUS DADOS</Text>
        <Cartao style={{ gap: 10 }}>
          <Text style={[tipo.corpo, { color: t.texto }]}>{talhoes.length} talhões · {medicoes.length} medições · {campos.length} campos de sementes · {viagens.length} viagens</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name={armazenamentoPersistente ? 'lock-closed' : 'lock-open'} size={18} color={armazenamentoPersistente ? t.ok : t.atencao} />
            <Text style={[tipo.corpo, { color: t.textoSuave, flex: 1 }]}>
              {armazenamentoPersistente === null ? 'Verificando o armazenamento…' : armazenamentoPersistente ? 'Armazenamento protegido: o navegador não apaga seus dados sozinho.' : 'O navegador pode apagar os dados se faltar espaço. Faça backup com frequência e instale o app na tela inicial.'}
            </Text>
          </View>
          <Botao titulo="Baixar backup completo" variante="suave" icone={<Ionicons name="cloud-download" size={19} color={t.primaria} />} onPress={baixar} />
        </Cartao>

        <Text style={[tipo.corpo, { color: t.textoSuave, textAlign: 'center', marginTop: 8, lineHeight: 20 }]}>
          Imagens de satélite © Esri, Maxar, Earthstar Geographics · Mapa, busca e rotas © colaboradores do OpenStreetMap (Nominatim, OSRM) · Áreas calculadas sobre a curvatura da Terra (elipsoide WGS 84).
        </Text>
      </ScrollView>
    </View>
  );
}
