export interface MerchantMenuItem { id?: string; name: string; price: number; description?: string; available: boolean; imageUrl?: string | null }
export interface MerchantRestaurant {
  id: string; name: string; address: string; category?: string; imageUrl?: string;
  location: { coordinates: [number, number] }; openingHours: string; active: boolean; menuItems: MerchantMenuItem[];
  suspendedAt?: string | null; suspendedReason?: string | null;
}
export function restaurantPayload(restaurant: MerchantRestaurant, menuItems: MerchantMenuItem[]) {
  const [longitude, latitude] = restaurant.location?.coordinates || [];
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error('Quán thiếu tọa độ hợp lệ, không thể lưu menu.');
  return { name: restaurant.name, address: restaurant.address, category: restaurant.category || '', imageUrl: restaurant.imageUrl || '',
    // Lưu menu/ảnh không được ghi lại trạng thái mở quán từ một snapshot đã cũ.
    latitude, longitude, openingHours: restaurant.openingHours,
    menuItems: menuItems.map((item) => ({ ...(item.id ? { id: item.id } : {}), name: item.name.trim(), price: Number(item.price), description: item.description || '', available: item.available, imageUrl: item.imageUrl || null })) };
}
