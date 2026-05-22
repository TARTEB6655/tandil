import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useIsAuthenticated } from '../store';
import { getCart } from '../services/cartService';

export type CartBadgeState = {
  count: number;
  refresh: () => void;
};

/** Total item quantity in the server cart; refreshes when the screen gains focus. */
export function useCartBadgeCount(): CartBadgeState {
  const isAuthenticated = useIsAuthenticated();
  const [count, setCount] = useState(0);

  const refresh = useCallback(() => {
    if (!isAuthenticated) {
      setCount(0);
      return;
    }
    getCart()
      .then((res) => {
        const items = res.data?.items ?? [];
        const total = items.reduce((sum, item) => sum + Math.max(0, item.quantity ?? 1), 0);
        setCount(total);
      })
      .catch(() => setCount(0));
  }, [isAuthenticated]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return { count, refresh };
}
