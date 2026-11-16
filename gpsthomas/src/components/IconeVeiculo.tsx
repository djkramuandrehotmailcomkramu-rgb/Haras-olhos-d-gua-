import { SvgXml } from 'react-native-svg';
import { svgVeiculo, type Veiculo } from './veiculos';

export function IconeVeiculo({ tipo, cor = '#1F7A3E', tamanho = 44 }: { tipo: Veiculo; cor?: string; tamanho?: number }) {
  return <SvgXml xml={svgVeiculo(tipo, cor, tamanho)} width={tamanho} height={tamanho} />;
}
