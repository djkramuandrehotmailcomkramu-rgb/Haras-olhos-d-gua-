import { Text, View } from 'react-native';
import { tipo, useTema } from '../theme';
import type { PropsMapa } from './MapaInterativo.types';

/** Versão nativa: o mapa interativo nativo (MapLibre) entra na fase de build Android. */
export function MapaInterativo(_: PropsMapa) {
  const t = useTema();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: t.cartaoSuave }}>
      <Text style={[tipo.corpo, { color: t.textoSuave, textAlign: 'center' }]}>
        O mapa interativo está disponível na versão web/PWA. A versão nativa chega com o build Android.
      </Text>
    </View>
  );
}
