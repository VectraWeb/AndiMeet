// PedidoForm.jsx — Formulario de pedido para clientes (para llevar / a domicilio)
import { useState, useRef, useCallback } from 'react';
import { Check, AlertCircle, ArrowLeft, ShoppingBag, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { C, todayISO } from '../utils';
import { Field } from './ui';
import CartaVirtual from './CartaVirtual';

// ─── Estilos ─────────────────────────────────────────────────────────────────
const inp = {
  width: '100%', padding: '12px 14px', fontSize: '16px',
  background: C.white, border: `1.5px solid ${C.creamDeep}`,
  borderRadius: '12px', color: C.espresso, outline: 'none',
  fontFamily: 'inherit',
  WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none',
};

// ═══════════════════════════════════════════════════════════════════════════════
// PedidoForm — Formulario de pedido para clientes
// El pedido es del día; el horario lo confirma el restaurante.
// ═══════════════════════════════════════════════════════════════════════════════
export default function PedidoForm({ onBack, onStaffAccess }) {
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ── Triple clic en logo → acceso staff ──────────────────────────────────
  const clickCount = useRef(0);
  const clickTimer = useRef(null);
  const handleLogoClicks = useCallback(() => {
    clickCount.current += 1;
    if (clickCount.current >= 3) {
      clickCount.current = 0;
      if (clickTimer.current) clearTimeout(clickTimer.current);
      if (onStaffAccess) onStaffAccess();
      return;
    }
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => { clickCount.current = 0; }, 1500);
  }, [onStaffAccess]);

  const [form, setForm] = useState({
    customerName: '',
    details: '',
  });
  const [showCarta, setShowCarta] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // ── Validación ───────────────────────────────────────────────────────────
  const valid = form.customerName.trim().length >= 2
    && form.details.trim().length >= 3
    && !submitting;

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!valid) return;
    setSubmitting(true);
    setError('');

    const id = `p${Date.now()}`;

    try {
      // GUARDADO SIMPLE: pedido del día, sin mesa ni horario fijado.
      // 'service' se guarda vacío (la regla de Firestore exige el campo,
      // pero el horario lo confirma el restaurante).
      // Aparecerá en el panel Pedidos del staff (source: 'cliente_web').
      await setDoc(doc(db, 'reservations', id), {
        id,
        customerName: form.customerName.trim(),
        service: '',
        time: '',
        date: todayISO(),
        notes: form.details.trim(),
        tipo: 'pedido',
        source: 'cliente_web',
        pedidoEstado: 'pendiente',
        mesa_id: null,
        estado: 'pendiente',
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setForm({ customerName: '', details: '' });
      }, 3000);
    } catch (e) {
      console.error('Error al crear el pedido:', e);
      setError('Error al enviar el pedido. Intente de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Si ya fue creado exitosamente ────────────────────────────────────────
  if (success) {
    return (
      <div style={{ padding: '60px 24px', textAlign: 'center' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: C.free, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <Check size={32} color="#fff" />
        </div>
        <h2 style={{ fontFamily: '"Fraunces", serif', fontSize: '24px', fontStyle: 'italic', fontWeight: 600, color: C.forest, margin: '0 0 8px' }}>
          Pedido enviado
        </h2>
        <p style={{ fontSize: '14px', color: C.muted, margin: 0 }}>
          {todayISO()}
        </p>
        <p style={{ fontSize: '14px', color: C.muted, margin: '4px 0 0' }}>
          Te confirmamos el horario
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 0 40px' }}>
      {/* Volver al selector */}
      {onBack && (
        <button onClick={onBack} style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          background: 'none', border: 'none', cursor: 'pointer',
          color: C.muted, fontSize: '13px', fontWeight: 600,
          fontFamily: 'inherit', padding: '18px 20px 0',
        }}>
          <ArrowLeft size={16} /> Volver
        </button>
      )}

      {/* Header branding */}
      <div style={{ padding: '32px 24px 24px', textAlign: 'center' }}>
        <h1 onClick={handleLogoClicks} style={{ fontFamily: '"Fraunces", serif', fontSize: '36px', fontStyle: 'italic', fontWeight: 700, color: C.forest, margin: 0, lineHeight: 1, cursor: 'default', userSelect: 'none' }}>
          Andi
        </h1>
        <p style={{ fontSize: '12px', color: C.muted, margin: '6px 0 0', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
          Hacé tu pedido
        </p>
      </div>

      {/* Formulario */}
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <Field label="Nombre">
          <input
            value={form.customerName}
            onChange={e => set('customerName', e.target.value)}
            placeholder="Tu nombre"
            style={inp}
            autoFocus
          />
        </Field>

        {/* Carta virtual */}
        <button onClick={() => setShowCarta(s => !s)} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', padding: '14px 16px',
          background: C.white, border: `1.5px solid ${C.creamDeep}`, borderRadius: '14px',
          cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
          transition: 'border-color 0.2s ease',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ width: '34px', height: '34px', borderRadius: '10px', background: `${C.forest}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <BookOpen size={17} color={C.forest} />
            </span>
            <span>
              <span style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: C.espresso }}>Ver nuestra carta</span>
              <span style={{ display: 'block', fontSize: '11px', color: C.muted, marginTop: '1px' }}>Consultá precios y productos</span>
            </span>
          </span>
          {showCarta ? <ChevronUp size={18} color={C.muted} /> : <ChevronDown size={18} color={C.muted} />}
        </button>

        {showCarta && <CartaVirtual />}

        <Field label="Detalle del pedido">
          <textarea
            value={form.details}
            onChange={e => set('details', e.target.value)}
            placeholder="¿Qué querés? Ej: 2 cafés con leche, 1 medialunas, 1 tostado..."
            rows={3}
            style={{ ...inp, resize: 'vertical' }}
          />
        </Field>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 14px', background: '#fef2f2', border: `1px solid ${C.terraSoft}`, borderRadius: '12px', fontSize: '13px', color: '#991b1b' }}>
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <button onClick={handleSubmit} disabled={!valid} style={{
          width: '100%', padding: '16px',
          background: valid ? C.terra : C.creamDeep,
          border: 'none', borderRadius: '14px',
          cursor: valid ? 'pointer' : 'not-allowed',
          color: valid ? C.white : C.muted,
          fontSize: '16px', fontWeight: 600,
          fontFamily: 'inherit',
          marginTop: '4px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        }}>
          <ShoppingBag size={18} />
          {submitting ? 'Enviando pedido...' : 'Enviar pedido'}
        </button>

        {!valid && !submitting && (
          <div style={{ padding: '10px 14px', background: '#fef2f2', border: `1px solid ${C.terraSoft}`, borderRadius: '12px', fontSize: '13px', color: '#991b1b', lineHeight: '1.4' }}>
            Completá tu nombre y el detalle del pedido para habilitar el envío.
          </div>
        )}
      </div>
    </div>
  );
}