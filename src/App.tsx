import { useState, useMemo, useEffect } from 'react';
// Import your existing supabase client
import { supabase } from './supabaseClient';
import { 
  ShoppingBag, 
  X,
  Zap,
  CheckCircle,
  Trash2,
  History,
  CreditCard,
  Loader2,
  Smartphone
} from 'lucide-react';

// --- TYPES ---
interface Product {
  id: number;
  brand: string;
  name: string;
  price: number;
  image: string;
  badge?: string;
  category: string;
  description?: string;
  tier?: string;
}

interface CartItem extends Product {
  qty: number;
}

interface Order {
  id: string;
  items: CartItem[];
  total: number;
  date: string;
}

interface Address {
  fullName: string;
  email: string;
  street: string;
  postcode: string;
  city: string;
}

interface CardInfo {
  number: string;
  expiry: string;
  cvc: string;
}

type CheckoutStep = 'cart' | 'address' | 'payment' | 'processing' | 'success';

const CATEGORIES: string[] = ['All', 'New Arrivals', 'Men', 'Women', 'Accessories', 'Offers'];
const DEAL_TIERS: string[] = ['DEALS RM150', 'DEALS RM120', 'DEALS RM100', 'DEALS RM80', 'DEALS RM60', 'DEALS RM25', 'DEALS RM20'];

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState<boolean>(false);
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>('cart');
  const [historyOpen, setHistoryOpen] = useState<boolean>(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'ewallet'>('card');
  const [activeDealFilter, setActiveDealFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // --- NEW CUSTOMER PROFILE STATE ---
  const [customerProfile, setCustomerProfile] = useState<any>(null);

  const [address, setAddress] = useState<Address>({
    fullName: '', email: '', street: '', postcode: '', city: ''
  });
  const [cardInfo, setCardInfo] = useState<CardInfo>({ number: '', expiry: '', cvc: '' });

  // --- FETCH PRODUCTS FROM SUPABASE ---
  useEffect(() => {
    async function fetchProducts() {
      const { data, error } = await supabase
        .from('Products Catalog Table')
        .select('*');
      
      if (error) {
        console.error('Error fetching products:', error);
      } else {
        setProducts(data || []);
      }
      setLoading(false);
    }
    fetchProducts();
  }, []);

  // --- NEW: FETCH LOGGED-IN CUSTOMER PROFILE ---
  useEffect(() => {
    async function getCustomerData() {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (error) {
          console.error('Error fetching profile:', error);
        } else if (data) {
          setCustomerProfile(data);
          // Auto-fill address details if they exist in the DB
          setAddress({
            fullName: data.full_name || '',
            email: data.email || '',
            street: data.address || '',
            postcode: data.postcode || '',
            city: data.city || ''
          });
        }
      }
    }
    getCustomerData();
  }, []);

  // --- FETCH ORDERS FROM SUPABASE ---
  useEffect(() => {
    async function fetchOrders() {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching orders:', error);
      } else if (data) {
        const formattedOrders: Order[] = data.map(o => ({
          id: o.order_id,
          items: o.items,
          total: o.total_amount,
          date: new Date(o.created_at).toLocaleString()
        }));
        setOrders(formattedOrders);
      }
    }
    fetchOrders();
  }, [checkoutStep]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesCat = activeCategory === 'All' || p.category === activeCategory;
      const matchesDeal = activeDealFilter ? p.tier === activeDealFilter : true;
      return matchesCat && matchesDeal;
    });
  }, [activeCategory, activeDealFilter, products]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      return [...prev, { ...product, qty: 1 }];
    });
    setCheckoutStep('cart');
    setCartOpen(true);
  };

  const updateQty = (id: number, delta: number) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, qty: Math.max(1, item.qty + delta) } : item));
  };

  const removeItem = (id: number) => setCart(prev => prev.filter(i => i.id !== id));

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const shipping = subtotal > 100 ? 0 : 15;
  const total = subtotal + shipping;

  const isAddressValid = address.fullName.trim().length > 3 && address.email.includes('@') && address.street.trim().length > 5;
  const isPaymentValid = paymentMethod === 'ewallet' || (cardInfo.number.length >= 16 && cardInfo.expiry.length >= 4);

  const handleCheckout = async () => {
    if (checkoutStep === 'cart') {
      setCheckoutStep('address');
    } else if (checkoutStep === 'address' && isAddressValid) {
      setCheckoutStep('payment');
    } else if (checkoutStep === 'payment' && isPaymentValid) {
      setCheckoutStep('processing');
      
      try {
        const response = await fetch('http://localhost:5000/create-bill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: total,              
            email: address.email,       
            name: address.fullName,     
            phone: '0123456789' 
          }),
        });

        const data = await response.json();

        if (data.url) {
          const orderId = `HQ-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
          
          // SAVE ORDER TO SUPABASE
          const { error } = await supabase.from('orders').insert([{
            order_id: orderId,
            items: cart,
            total_amount: total,
            customer_email: address.email,
            customer_name: address.fullName,
            customer_id: customerProfile?.id // Linking order to customer ID
          }]);

          if (error) throw error;

          window.location.href = data.url;
        } else {
          alert("Failed to initialize payment.");
          setCheckoutStep('payment');
        }
      } catch (error) {
        console.error('Checkout error:', error);
        alert("Transaction failed. Check console for details.");
        setCheckoutStep('payment');
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-[#D9FF00] selection:text-black">
      <div className="bg-blue-600 text-white text-[10px] font-black text-center py-2 px-4 tracking-[0.1em] uppercase z-50 relative">
        Free Shipping With Order Above RM100 In Malaysia
      </div>

      <nav className="bg-black border-b border-white/10 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-20 flex justify-between items-center">
          <span 
            className="text-3xl font-black tracking-tighter italic cursor-pointer group" 
            onClick={() => {setActiveCategory('All'); setHistoryOpen(false); setActiveDealFilter(null)}}
          >
            STREET<span className="text-black bg-[#D9FF00] px-2 ml-1 not-italic group-hover:bg-white transition-colors">HQ</span>
          </span>

          <div className="hidden md:flex space-x-1">
            {CATEGORIES.map(item => (
              <button 
                key={item} 
                onClick={() => {setActiveCategory(item); setHistoryOpen(false); setActiveDealFilter(null)}}
                className={`text-[9px] font-black uppercase tracking-widest px-4 py-2 transition-all ${activeCategory === item ? 'bg-white text-black' : 'text-white/50 hover:text-white'}`}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            {/* DISPLAY TIER BADGE IF CUSTOMER IS LOGGED IN */}
            {customerProfile && (
              <span className="text-[8px] font-black bg-[#D9FF00] text-black px-2 py-1 uppercase italic rounded-sm">
                {customerProfile.tier || 'MEMBER'}
              </span>
            )}
            <button onClick={() => setHistoryOpen(!historyOpen)} className={`p-2 ${historyOpen ? 'text-[#D9FF00]' : 'text-white/50'}`}>
              <History className="h-5 w-5" />
            </button>
            <div className="relative cursor-pointer" onClick={() => {setCartOpen(true); setCheckoutStep('cart');}}>
              <ShoppingBag className="h-5 w-5" />
              {cart.length > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-[#D9FF00] text-black text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-full">
                  {cart.reduce((a, b) => a + b.qty, 0)}
                </span>
              )}
            </div>
          </div>
        </div>
      </nav>

      {!historyOpen ? (
        <main className="max-w-7xl mx-auto px-4 py-12">
          <div className="mb-12">
            <h2 className="text-5xl font-black uppercase italic tracking-tighter mb-4">
              {activeCategory === 'All' ? 'CORE_COLLECTION' : activeCategory}
            </h2>
            <div className="h-1 w-full bg-white/10" />
          </div>

          <div className="flex flex-col lg:flex-row gap-8">
            {activeCategory === 'Offers' && (
              <aside className="w-full lg:w-48 flex-none">
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Deals Archive</h3>
                  <div className="flex flex-col gap-3">
                    {DEAL_TIERS.map(deal => (
                      <button 
                        key={deal}
                        onClick={() => setActiveDealFilter(activeDealFilter === deal ? null : deal)}
                        className={`text-left text-[11px] font-black uppercase transition-all ${activeDealFilter === deal ? 'text-[#D9FF00]' : 'text-white/60 hover:text-white'}`}
                      >
                        {deal}
                      </button>
                    ))}
                  </div>
                </div>
              </aside>
            )}

            <div className="flex-1 grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-12">
              {loading ? (
                 <div className="col-span-full h-40 flex items-center justify-center"><Loader2 className="animate-spin" /></div>
              ) : filteredProducts.map(product => (
                <div key={product.id} className="group">
                  <div className="relative aspect-[3/4] bg-[#111] overflow-hidden mb-4 border border-white/5">
                    <img src={product.image} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" alt="" />
                    <button 
                      onClick={() => addToCart(product)} 
                      className="absolute bottom-4 left-4 right-4 bg-white text-black py-4 font-black uppercase text-[10px] opacity-0 group-hover:opacity-100 transition-all"
                    >
                      ADD TO GEAR
                    </button>
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-[10px] font-black text-white/40 uppercase">{product.brand}</h4>
                    <h3 className="text-sm font-black uppercase group-hover:text-[#D9FF00]">{product.name}</h3>
                    {product.description && <p className="text-[10px] font-bold text-[#D9FF00] uppercase italic">{product.description}</p>}
                    <p className="text-xs font-mono text-white/60">RM {product.price}.00</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      ) : (
        <div className="max-w-4xl mx-auto px-4 py-20 min-h-[70vh]">
            <h2 className="text-5xl font-black uppercase italic tracking-tighter mb-12">Deployment History</h2>
            {orders.length === 0 ? (
              <div className="py-20 text-center border border-dashed border-white/10 opacity-30 uppercase font-black text-xs">No transactions recorded.</div>
            ) : (
              <div className="space-y-6">
                {orders.map(order => (
                  <div key={order.id} className="bg-white/5 border border-white/10 p-8 rounded-sm">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <p className="text-[#D9FF00] font-mono text-xs tracking-widest">{order.id}</p>
                        <p className="text-[10px] text-white/40 uppercase font-black">{order.date}</p>
                      </div>
                      <span className="text-[9px] font-black bg-white/10 text-white px-3 py-1 uppercase italic">Completed</span>
                    </div>
                    <div className="space-y-2 border-t border-white/5 pt-4">
                      {order.items.map((i, idx) => (
                        <div key={idx} className="flex justify-between text-[10px] uppercase font-bold text-white/60">
                          <span>{i.name} x{i.qty}</span>
                          <span>RM {i.price * i.qty}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 pt-4 border-t border-white/10 flex justify-between font-black">
                      <span className="uppercase text-xs italic text-white/40">Total Secured</span>
                      <span className="text-xl">RM {order.total}.00</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
      )}

      {cartOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setCartOpen(false)} />
          <div className="relative w-full max-w-lg bg-[#0a0a0a] border-l border-white/10 h-full flex flex-col">
            <div className="p-8 flex justify-between items-center border-b border-white/5">
              <h2 className="text-3xl font-black uppercase italic tracking-tighter">
                {checkoutStep === 'cart' && 'INVENTORY'}
                {checkoutStep === 'address' && 'COORDINATES'}
                {checkoutStep === 'payment' && 'SECURE_TRANSFER'}
                {checkoutStep === 'processing' && 'ENCRYPTING...'}
                {checkoutStep === 'success' && 'SIGNAL_SECURED'}
              </h2>
              <button onClick={() => setCartOpen(false)}><X className="h-6 w-6 text-[#D9FF00]" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8">
              {checkoutStep === 'cart' && (
                <div className="space-y-6">
                  {cart.length === 0 ? (
                    <div className="h-40 flex items-center justify-center opacity-20 uppercase font-black text-xs border border-dashed border-white/10 italic">Zero Gear Staged</div>
                  ) : cart.map(item => (
                    <div key={item.id} className="flex gap-6 items-center">
                      <img src={item.image} className="w-16 h-20 object-cover grayscale border border-white/10" alt="" />
                      <div className="flex-1">
                        <p className="text-[9px] font-black text-white/40 uppercase">{item.brand}</p>
                        <p className="text-sm font-black uppercase">{item.name}</p>
                        <div className="flex justify-between items-center mt-3">
                            <div className="flex border border-white/10">
                             <button onClick={() => updateQty(item.id, -1)} className="px-3 py-1 text-[#D9FF00]">-</button>
                             <span className="px-3 py-1 text-[11px] font-black border-x border-white/10">{item.qty}</span>
                             <button onClick={() => updateQty(item.id, 1)} className="px-3 py-1 text-[#D9FF00]">+</button>
                           </div>
                           <span className="text-xs font-mono font-black">RM {item.price * item.qty}</span>
                        </div>
                      </div>
                      <button onClick={() => removeItem(item.id)} className="p-2 text-white/20 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
              )}

              {checkoutStep === 'address' && (
                <div className="space-y-5">
                  <input className="w-full bg-white/5 border border-white/10 p-4 text-sm font-black outline-none focus:border-[#D9FF00]" value={address.fullName} onChange={e => setAddress({...address, fullName: e.target.value})} placeholder="FULL NAME" />
                  <input className="w-full bg-white/5 border border-white/10 p-4 text-sm font-black outline-none focus:border-[#D9FF00]" value={address.email} onChange={e => setAddress({...address, email: e.target.value})} placeholder="EMAIL" />
                  <input className="w-full bg-white/5 border border-white/10 p-4 text-sm font-black outline-none focus:border-[#D9FF00]" value={address.street} onChange={e => setAddress({...address, street: e.target.value})} placeholder="STREET ADDRESS" />
                  <div className="grid grid-cols-2 gap-4">
                    <input className="w-full bg-white/5 border border-white/10 p-4 text-sm font-black outline-none focus:border-[#D9FF00]" value={address.postcode} onChange={e => setAddress({...address, postcode: e.target.value})} placeholder="POSTCODE" maxLength={5} />
                    <input className="w-full bg-white/5 border border-white/10 p-4 text-sm font-black outline-none focus:border-[#D9FF00]" value={address.city} onChange={e => setAddress({...address, city: e.target.value})} placeholder="CITY" />
                  </div>
                </div>
              )}

              {checkoutStep === 'payment' && (
                <div className="space-y-6">
                  <div className="flex gap-2">
                    <button onClick={() => setPaymentMethod('card')} className={`flex-1 p-5 border flex flex-col items-center gap-3 ${paymentMethod === 'card' ? 'border-[#D9FF00] bg-[#D9FF00]/5' : 'border-white/10 opacity-40'}`}>
                      <CreditCard className="h-5 w-5" />
                      <span className="text-[9px] font-black uppercase">Card</span>
                    </button>
                    <button onClick={() => setPaymentMethod('ewallet')} className={`flex-1 p-5 border flex flex-col items-center gap-3 ${paymentMethod === 'ewallet' ? 'border-[#D9FF00] bg-[#D9FF00]/5' : 'border-white/10 opacity-40'}`}>
                      <Smartphone className="h-5 w-5" />
                      <span className="text-[9px] font-black uppercase">e-Wallet</span>
                    </button>
                  </div>
                  {paymentMethod === 'card' && (
                    <div className="space-y-4">
                      <input className="w-full bg-white/5 border border-white/10 p-4 text-sm font-black outline-none focus:border-[#D9FF00]" placeholder="CARD NUMBER" maxLength={16} value={cardInfo.number} onChange={e => setCardInfo({...cardInfo, number: e.target.value})} />
                      <div className="grid grid-cols-2 gap-4">
                        <input className="w-full bg-white/5 border border-white/10 p-4 text-sm font-black outline-none focus:border-[#D9FF00]" placeholder="MM/YY" maxLength={4} value={cardInfo.expiry} onChange={e => setCardInfo({...cardInfo, expiry: e.target.value})} />
                        <input className="w-full bg-white/5 border border-white/10 p-4 text-sm font-black outline-none focus:border-[#D9FF00]" placeholder="CVC" maxLength={3} value={cardInfo.cvc} onChange={e => setCardInfo({...cardInfo, cvc: e.target.value})} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {checkoutStep === 'processing' && (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <Loader2 className="h-16 w-16 text-[#D9FF00] animate-spin mb-8" />
                  <h3 className="text-3xl font-black uppercase italic tracking-tighter">Authenticating...</h3>
                </div>
              )}

              {checkoutStep === 'success' && (
                <div className="h-full flex flex-col items-center justify-center text-center px-4">
                  <div className="w-24 h-24 bg-[#D9FF00] rounded-full flex items-center justify-center mb-8">
                    <CheckCircle className="h-12 w-12 text-black" />
                  </div>
                  <h3 className="text-4xl font-black uppercase italic tracking-tighter mb-4">Gear Secured</h3>
                  <button onClick={() => {setCartOpen(false); setHistoryOpen(true);}} className="w-full py-5 bg-white text-black font-black uppercase text-[10px] tracking-[0.2em]">Check Archives</button>
                </div>
              )}
            </div>

            {['cart', 'address', 'payment'].includes(checkoutStep) && (
              <div className="p-8 bg-black/80 border-t border-white/10 space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-black uppercase text-white/30 italic"><span>Subtotal</span><span>RM {subtotal}.00</span></div>
                  <div className="flex justify-between text-xs font-black uppercase text-white/30 italic"><span>Delivery</span><span>{shipping === 0 ? 'FREE' : `RM ${shipping}.00`}</span></div>
                  <div className="flex justify-between text-3xl font-black uppercase italic mt-4">
                    <span>Final_Sum</span>
                    <span className="text-[#D9FF00]">RM {total}.00</span>
                  </div>
                </div>
                <button 
                  onClick={handleCheckout}
                  disabled={cart.length === 0 || (checkoutStep === 'address' && !isAddressValid) || (checkoutStep === 'payment' && !isPaymentValid)}
                  className={`w-full py-6 font-black uppercase tracking-[0.2em] text-[11px] flex items-center justify-center gap-3 transition-all ${((checkoutStep === 'address' && isAddressValid) || (checkoutStep === 'payment' && isPaymentValid) || checkoutStep === 'cart') && cart.length > 0 ? 'bg-[#D9FF00] text-black' : 'bg-white/5 text-white/20'}`}
                >
                  {checkoutStep === 'cart' ? 'Establish Deployment' : checkoutStep === 'address' ? 'Initialize Payment' : 'Confirm & Secure Transfer'}
                  <Zap className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <footer className="bg-black border-t-4 border-[#D9FF00] py-20 text-center">
        <span className="text-6xl font-black tracking-tighter italic select-none">STREET<span className="text-black bg-[#D9FF00] px-3 ml-1 not-italic">HQ</span></span>
      </footer>
    </div>
  );
}