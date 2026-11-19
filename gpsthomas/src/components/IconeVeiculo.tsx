import { SvgXml } from 'react-native-svg';
import { svgVeiculo, type Veiculo } from './veiculos';

export function IconeVeiculo({ tipo, cor = '#5B4FE0', tamanho = 44 }: { tipo: Veiculo; cor?: string; tamanho?: number }) {
  return <SvgXml xml={svgVeiculo(tipo, cor, tamanho)} width={tamanho} height={tamanho} />;
}
