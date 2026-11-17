import { useLocalSearchParams } from 'expo-router';
import { PantallaChat } from '../../../componentes/PantallaChat';

/** CU-05 · Chat sobre un pedido. */
export default function Chat() {
  const { id } = useLocalSearchParams();
  return <PantallaChat idPedido={id} />;
}
