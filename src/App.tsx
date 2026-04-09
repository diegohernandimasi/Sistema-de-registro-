import * as React from 'react';
import { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp, 
  doc, 
  runTransaction,
  getDoc,
  setDoc
} from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { db, auth, OperationType, handleFirestoreError } from './firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { UserPlus, Users, Phone, User, Hash, Loader2, LogIn, LogOut } from 'lucide-react';

interface Registration {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  registrationNumber: number;
  createdAt: any;
}

export default function App() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Initialize counter if it doesn't exist
  useEffect(() => {
    const initCounter = async () => {
      const counterRef = doc(db, 'counters', 'registrations');
      try {
        const counterSnap = await getDoc(counterRef);
        if (!counterSnap.exists()) {
          await setDoc(counterRef, { count: 0 });
        }
        setIsReady(true);
      } catch (error) {
        console.error('Error initializing counter:', error);
        // If it's a permission error, we use the standard handler
        if (error instanceof Error && error.message.includes('permission')) {
          handleFirestoreError(error, OperationType.WRITE, 'counters/registrations');
        }
        setIsReady(true);
      }
    };
    initCounter();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      toast.success('Sesión iniciada');
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Error al iniciar sesión');
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      toast.success('Sesión cerrada');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Listen for registrations in real-time
  useEffect(() => {
    const q = query(collection(db, 'registrations'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Registration[];
      setRegistrations(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'registrations');
    });

    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !phone) {
      toast.error('Por favor complete todos los campos');
      return;
    }

    setLoading(true);
    try {
      const newRegNumber = await runTransaction(db, async (transaction) => {
        const counterRef = doc(db, 'counters', 'registrations');
        const counterSnap = await transaction.get(counterRef);
        
        let newCount = 1;
        if (counterSnap.exists()) {
          newCount = counterSnap.data().count + 1;
        }
        
        transaction.set(counterRef, { count: newCount });
        
        const registrationRef = doc(collection(db, 'registrations'));
        transaction.set(registrationRef, {
          firstName,
          lastName,
          phone,
          registrationNumber: newCount,
          createdAt: serverTimestamp()
        });
        
        return newCount;
      });

      toast.success('Registro exitoso', {
        description: `Se ha generado el número de registro: ${newRegNumber}`
      });
      
      // Clear inputs
      setFirstName('');
      setLastName('');
      setPhone('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'registrations');
      toast.error('Error al procesar el registro');
    } finally {
      setLoading(false);
    }
  };

  if (!isReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-2 relative"
        >
          <div className="absolute right-0 top-0">
            {currentUser ? (
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-slate-500 hover:text-destructive">
                <LogOut className="w-4 h-4 mr-2" />
                Salir
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={handleLogin} className="text-slate-500 hover:text-primary">
                <LogIn className="w-4 h-4 mr-2" />
                Admin
              </Button>
            )}
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">Sistema de Registros</h1>
          <p className="text-slate-500">Cargue los datos para generar un nuevo número de registro en tiempo real.</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Form Section */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="md:col-span-1"
          >
            <Card className="border-none shadow-lg bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-primary" />
                  Nuevo Registro
                </CardTitle>
                <CardDescription>Ingrese los detalles de la persona.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-xs font-semibold uppercase tracking-wider text-slate-500">Nombre</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input 
                        id="firstName"
                        placeholder="Ej: Juan" 
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="pl-10 bg-slate-50/50 border-slate-200 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-xs font-semibold uppercase tracking-wider text-slate-500">Apellido</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input 
                        id="lastName"
                        placeholder="Ej: Pérez" 
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="pl-10 bg-slate-50/50 border-slate-200 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-xs font-semibold uppercase tracking-wider text-slate-500">Teléfono</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input 
                        id="phone"
                        type="tel"
                        placeholder="Ej: +54 9 11..." 
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="pl-10 bg-slate-50/50 border-slate-200 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full mt-4 bg-primary hover:bg-primary/90 text-white shadow-md transition-all active:scale-95"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      'Cargar Datos'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>

          {/* Table Section */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="md:col-span-2"
          >
            <Card className="border-none shadow-lg bg-white/80 backdrop-blur-sm overflow-hidden">
              <CardHeader className="border-b border-slate-100 bg-slate-50/30">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    Registros Actuales
                  </CardTitle>
                  <div className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold">
                    {registrations.length} Total
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[500px] overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                      <TableRow className="hover:bg-transparent border-slate-100">
                        <TableHead className="w-[80px] text-center"><Hash className="w-4 h-4 mx-auto" /></TableHead>
                        <TableHead>Nombre Completo</TableHead>
                        <TableHead>Teléfono</TableHead>
                        <TableHead className="text-right">Fecha</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence mode="popLayout">
                        {registrations.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="h-32 text-center text-slate-400 italic">
                              No hay registros aún.
                            </TableCell>
                          </TableRow>
                        ) : (
                          registrations.map((reg) => (
                            <motion.tr
                              key={reg.id}
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              layout
                              className="group hover:bg-slate-50/50 transition-colors border-slate-100"
                            >
                              <TableCell className="text-center font-mono font-bold text-primary">
                                {reg.registrationNumber}
                              </TableCell>
                              <TableCell className="font-medium">
                                {reg.firstName} {reg.lastName}
                              </TableCell>
                              <TableCell className="text-slate-600 font-mono text-sm">
                                {reg.phone}
                              </TableCell>
                              <TableCell className="text-right text-slate-400 text-xs">
                                {reg.createdAt?.toDate() ? new Date(reg.createdAt.toDate()).toLocaleDateString() : 'Pendiente...'}
                              </TableCell>
                            </motion.tr>
                          ))
                        )}
                      </AnimatePresence>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
      <Toaster position="top-right" richColors />
    </div>
  );
}
