import React, { createContext, useContext, useMemo, useReducer } from 'react';

const CartContext = createContext(null);

function reducer(state, action) {
  switch (action.type) {
    case 'ADD': {
      const { id, name, price, qty = 1 } = action.payload;
      const next = [...state.items];
      const idx = next.findIndex((i) => i.id === id);
      if (idx >= 0) next[idx] = { ...next[idx], qty: next[idx].qty + qty };
      else next.push({ id, name, price: Number(price || 0), qty });
      return { ...state, items: next };
    }
    case 'INC': {
      const next = state.items.map(i => i.id === action.id ? { ...i, qty: i.qty + 1 } : i);
      return { ...state, items: next };
    }
    case 'DEC': {
      const next = state.items.map(i =>
        i.id === action.id ? { ...i, qty: Math.max(1, i.qty - 1) } : i
      );
      return { ...state, items: next };
    }
    case 'REMOVE': {
      const next = state.items.filter(i => i.id !== action.id);
      return { ...state, items: next };
    }
    case 'CLEAR':
      return { ...state, items: [] };
    default:
      return state;
  }
}

export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, { items: [] });

  const api = useMemo(() => {
    const addItem = ({ id, name, price, qty = 1 }) =>
      dispatch({ type: 'ADD', payload: { id, name, price, qty } });

    const addToCart = (item) => addItem(item);
    const increment = (id) => dispatch({ type: 'INC', id });
    const decrement = (id) => dispatch({ type: 'DEC', id });

    const removeItem = (id) => dispatch({ type: 'REMOVE', id });
    const remove = (id) => removeItem(id);                 // 👈 alias so `remove()` also works

    const clearCart = () => dispatch({ type: 'CLEAR' });

    const total = state.items.reduce((s, it) => s + Number(it.price || 0) * (it.qty || 1), 0);

    return {
      items: state.items,
      total,
      addItem,
      addToCart,
      increment,
      decrement,
      removeItem,
      remove,        // 👈 alias exposed
      clearCart,
    };
  }, [state.items]);

  return <CartContext.Provider value={api}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
