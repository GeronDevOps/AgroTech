import { useRouter } from 'expo-router';
import { ListaPedidos } from '../../componentes/ListaPedidos';

/** CU-13 · Pedidos recibidos: el productor abre cada uno para aceptarlo, rechazarlo o avanzar su estado. */
export default function PedidosProductor() {
  const router = useRouter();
  return (
    <ListaPedidos
      contraparteDe={(p) => p.consumidor.nombre}
      onAbrir={(p) => router.push(`/productor/pedido/${p.id}`)}
      vacio="No tiene pedidos por atender."
    />
  );
}
