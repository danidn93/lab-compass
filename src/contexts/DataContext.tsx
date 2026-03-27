import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Patient, Reagent, LabTest, Order, OrderResult, InventoryMovement, LabConfig } from '@/types';
import { mockPatients, mockReagents, mockTests, mockOrders, mockResults, mockMovements, defaultLabConfig } from '@/data/mockData';

interface DataContextType {
  labConfig: LabConfig;
  setLabConfig: React.Dispatch<React.SetStateAction<LabConfig>>;
  patients: Patient[];
  setPatients: React.Dispatch<React.SetStateAction<Patient[]>>;
  reagents: Reagent[];
  setReagents: React.Dispatch<React.SetStateAction<Reagent[]>>;
  tests: LabTest[];
  setTests: React.Dispatch<React.SetStateAction<LabTest[]>>;
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  results: OrderResult[];
  setResults: React.Dispatch<React.SetStateAction<OrderResult[]>>;
  movements: InventoryMovement[];
  setMovements: React.Dispatch<React.SetStateAction<InventoryMovement[]>>;
  lowStockReagents: Reagent[];
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [labConfig, setLabConfig] = useState<LabConfig>(defaultLabConfig);
  const [patients, setPatients] = useState<Patient[]>(mockPatients);
  const [reagents, setReagents] = useState<Reagent[]>(mockReagents);
  const [tests, setTests] = useState<LabTest[]>(mockTests);
  const [orders, setOrders] = useState<Order[]>(mockOrders);
  const [results, setResults] = useState<OrderResult[]>(mockResults);
  const [movements, setMovements] = useState<InventoryMovement[]>(mockMovements);

  const lowStockReagents = reagents.filter(r => r.currentStock <= r.minStock);

  return (
    <DataContext.Provider value={{
      labConfig, setLabConfig,
      patients, setPatients,
      reagents, setReagents,
      tests, setTests,
      orders, setOrders,
      results, setResults,
      movements, setMovements,
      lowStockReagents,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
