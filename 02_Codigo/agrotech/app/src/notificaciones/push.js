import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { api } from '../api/cliente';

/**
 * Notificaciones push (CU-16 · RF-16a: aviso de nuevo pedido al productor; también "pedido pagado").
 * - Paso 1: en el inicio de sesión se pide permiso y se registra el token FCM del teléfono (POST /dispositivos).
 * - Paso 3: al tocar el aviso, la app abre el pedido.
 * - A1: si el permiso se niega, los avisos llegan solo dentro de la app (WebSocket y "Mis pedidos").
 * Requiere una compilación de desarrollo o el APK (Expo Go no recibe push en Android) y google-services.json.
 */
let tokenRegistrado = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export async function registrarPush() {
  if (Platform.OS !== 'android') return null;
  try {
    await Notifications.setNotificationChannelAsync('pedidos', {
      // eslint-disable-next-line import/namespace -- AndroidImportance sí existe (export * de expo-notifications 58); el plugin no lo resuelve
      name: 'Pedidos', importance: Notifications.AndroidImportance.HIGH, sound: 'default', vibrationPattern: [0, 250, 250, 250],
    });
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
    if (status !== 'granted') return null; // A1
    const { data: token } = await Notifications.getDevicePushTokenAsync();
    await api.registrarDispositivo(token);
    tokenRegistrado = token;
    return token;
  } catch {
    return null; // sin Firebase configurado (Expo Go) o sin señal: se reintenta en el próximo inicio de sesión (A2)
  }
}

/** Al cerrar sesión: el teléfono deja de recibir avisos de esa cuenta. Sin señal no bloquea la salida. */
export async function desregistrarPush() {
  if (!tokenRegistrado) return;
  const token = tokenRegistrado;
  tokenRegistrado = null;
  await api.borrarDispositivo(token).catch(() => {});
}

/** Registra el teléfono al iniciar sesión y abre el pedido al tocar un aviso. */
export function useNotificacionesPush(usuario) {
  const router = useRouter();
  const idUsuario = usuario ? usuario.id : null;
  const rol = usuario ? usuario.rol : null;

  useEffect(() => {
    if (idUsuario) registrarPush();
  }, [idUsuario]);

  useEffect(() => {
    if (!rol) return undefined;
    if (rol === 'ADMINISTRADOR') return undefined;
    const base = rol === 'PRODUCTOR' ? '/productor' : '/consumidor';
    // CU-16 paso 3: el aviso abre el pedido o, si es un mensaje, el chat del pedido.
    const abrir = (respuesta) => {
      const datos = respuesta && respuesta.notification.request.content.data;
      const id = datos && datos.idPedido;
      if (id) router.push(`${base}/${datos.abrir === 'CHAT' ? 'chat' : 'pedido'}/${id}`);
    };
    // App cerrada: el aviso que la abrió.
    Notifications.getLastNotificationResponseAsync().then(abrir).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(abrir);
    return () => sub.remove();
  }, [rol, router]);
}
