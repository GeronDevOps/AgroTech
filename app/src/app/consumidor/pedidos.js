import { useLocalSearchParams, useRouter } from 'expo-router';
import { Aviso } from '../../componentes/Aviso';
import { ListaPedidos } from '../../componentes/ListaPedidos';

/** CU-15 · Mis pedidos (RF-15a y RF-15): activos, finalizados o todos, por periodo, con estado y último cambio (CA-14). */
export default function PedidosConsumidor() {
  const router = useRouter();
  const { nuevos } = useLocalSearchParams();
  return (
    <ListaPedidos
      contraparteDe={(p) => p.productor.nombre}
      onAbrir={(p) => router.push(`/consumidor/pedido/${p.id}`)}
      vacio="No tiene pedidos activos."
      accionVacio={{ titulo: '🛒 Ir al catálogo', onPress: () => router.replace('/consumidor') }}
      encabezado={nuevos ? <Aviso tipo="info" mensaje={`✓ Se crearon ${nuevos} pedidos, uno por productor.`} testID="aviso-nuevos" /> : null}
    />
  );
}
