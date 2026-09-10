import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, authReady } from '../firebase';

const staffCol = () => collection(db, 'staff');

export function useStaff() {
  const [staff, setStaff] = useState([]);

  useEffect(() => {
    let cancelled = false;
    let unsub = null;

    authReady.then(() => {
      if (cancelled) return;
      unsub = onSnapshot(staffCol(), (snap) => {
        if (cancelled) return;
        setStaff(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
    });

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, []);

  return staff;
}
