import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { request } from '../api';
import { MerchantRestaurant } from '../pages/merchant/types';

const MerchantContext = createContext<any>(null);
export function MerchantProvider({ children }: { children: ReactNode }) {
  const [restaurants, setRestaurants] = useState<MerchantRestaurant[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    request('/restaurants/mine').then((data) => {
      if (!active) return;
      const list = Array.isArray(data) ? data : data.data || [];
      setRestaurants(list); setSelectedId((old) => list.some((r: MerchantRestaurant) => r.id === old) ? old : list[0]?.id || '');
    }).catch((e) => { if (active) setError(e.message || 'Không thể tải quán của bạn'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);
  const updateRestaurant = useCallback((restaurant: MerchantRestaurant) => {
    setRestaurants((old) => old.some((r) => r.id === restaurant.id) ? old.map((r) => r.id === restaurant.id ? restaurant : r) : [...old, restaurant]);
    setSelectedId(restaurant.id);
  }, []);
  return <MerchantContext.Provider value={{ restaurants, restaurant: restaurants.find((r) => r.id === selectedId), selectedId, setSelectedId,
    loading, error, refresh: () => setRevision((v) => v + 1), updateRestaurant, dirty, setDirty, saving, setSaving }}>{children}</MerchantContext.Provider>;
}
export function useMerchant() { return useContext(MerchantContext); }
