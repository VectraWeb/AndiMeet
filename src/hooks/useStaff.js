import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, authReady } from '../firebase';

const staffCol = () => collection(db, 'staff');

export function useStaff() {
  const [staff, setStaff] = useState([]);

  useEffect(() => {
    let unsub;
    authReady.then(() => {
      unsub = onSnapshot(staffCol(), (snap) => {
        setStaff(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
    });
    return () => { if (unsub) unsub(); };
  }, []);

  return staff;
}
