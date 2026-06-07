
import NetInfo from '@react-native-community/netinfo';
import { debugLogger } from '@/services/debugLogger';
import { useEffect, useState } from 'react';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [connectionType, setConnectionType] = useState<string>('unknown');

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected ?? false;
      setIsOnline(online);
      setConnectionType(state.type);

      debugLogger.log('Status de rede alterado', {
        isOnline: online,
        type: state.type,
        isInternetReachable: state.isInternetReachable,
      });
    });

    NetInfo.fetch().then((state) => {
      const online = state.isConnected ?? false;
      setIsOnline(online);
      setConnectionType(state.type);
      debugLogger.log('Status de rede inicial', {
        isOnline: online,
        type: state.type,
      });
    });

    return () => unsubscribe();
  }, []);

  return { isOnline, connectionType };
}
