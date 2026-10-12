import { useLocalSearchParams, useRouter } from 'expo-router';
import { Aviso } from '../../componentes/Aviso';
import { ListaPedidos } from '../../componentes/ListaPedidos';

/** CU-15 · Mis pedidos (RF-15a): activos primero, con su estado y la fecha del último cambio (CA-14). */
export default function PedidosConsumidor() {
  const router = useRouter();
  const { nuevos } = useLocalSearchParams();
  return (
    <ListaPedidos
      contraparteDe={(p) => p.productor.nombre}
      onAbrir={(p) => router.push(`/consumidor/pedido/${p.id}`)}
      vacio="No tiene pedidos activos."
      encabezado={nuevos ? <Aviso tipo="info" mensaje={`✓ Se crearon ${nuevos} pedidos, uno por productor.`} testID="aviso-nuevos" /> : null}
    />
  );
}
