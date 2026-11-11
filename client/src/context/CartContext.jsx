import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const CartContext = createContext(null);
const STORAGE_KEY = 'ad-shop-cart-v2';
const normalizeItems = (value) => Array.isArray(value)
  ? value.filter((item) => item && typeof item.product_id === 'string' && Number.isInteger(item.quantity) && item.quantity > 0)
    .slice(0, 30)
    .map((item) => ({ product_id: item.product_id, variant_id: typeof item.variant_id === 'string' ? item.variant_id : null, quantity: Math.min(10, item.quantity) }))
  : [];

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setItems(normalizeItems(JSON.parse(saved)));
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [hydrated, items]);

  const value = useMemo(() => ({
    items,
    hydrated,
    count: items.reduce((total, item) => total + item.quantity, 0),
    addItem(productId, variantId = null, quantity = 1) {
      setItems((current) => {
        const found = current.find((item) => item.product_id === productId && item.variant_id === variantId);
        if (found) return current.map((item) => item === found ? { ...item, quantity: Math.min(10, item.quantity + quantity) } : item);
        if (current.length >= 30) return current;
        return [...current, { product_id: productId, variant_id: variantId, quantity: Math.min(10, quantity) }];
      });
    },
    updateQuantity(productId, variantId, quantity) {
      setItems((current) => quantity <= 0
        ? current.filter((item) => !(item.product_id === productId && item.variant_id === variantId))
        : current.map((item) => item.product_id === productId && item.variant_id === variantId ? { ...item, quantity: Math.min(10, quantity) } : item));
    },
    removeItem(productId, variantId = null) {
      setItems((current) => current.filter((item) => !(item.product_id === productId && item.variant_id === variantId)));
    },
    clear() { setItems([]); },
  }), [hydrated, items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error('useCart doit être utilisé dans CartProvider.');
  return value;
}
