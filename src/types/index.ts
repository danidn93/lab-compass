export interface LabConfig {
  logo: string;
  name: string;
  owner: string;
  address: string;
  ruc: string;
  healthRegistry: string;
  phone: string;
  schedule: string;
}

export interface User {
  id: string;
  username: string;
  password: string;
  role: 'admin' | 'laboratorist';
  name: string;
}

export interface Patient {
  id: string;
  name: string;
  cedula: string;
  phone: string;
  email: string;
  birthDate: string;
  sex: 'M' | 'F';
}

export interface Reagent {
  id: string;
  name: string;
  code: string;
  currentStock: number;
  minStock: number;
  expirationDate: string;
  supplier: string;
}

export interface InventoryMovement {
  id: string;
  reagentId: string;
  type: 'entry' | 'exit';
  quantity: number;
  date: string;
  reason: string;
}

export interface ReferenceRange {
  id: string;
  parameterId: string;
  sex: 'M' | 'F' | 'both';
  minAge: number;
  maxAge: number;
  minValue: number;
  maxValue: number;
}

export interface TestParameter {
  id: string;
  testId: string;
  name: string;
  unit: string;
  ranges: ReferenceRange[];
}

export interface LabTest {
  id: string;
  name: string;
  description: string;
  price: number;
  parameters: TestParameter[];
  reagents: TestReagent[];
}

export interface TestReagent {
  reagentId: string;
  quantityUsed: number;
}

export interface Order {
  id: string;
  code: string;
  accessKey: string;
  patientId: string;
  testIds: string[];
  total: number;
  status: 'pending' | 'in_progress' | 'completed';
  date: string;
}

export interface ResultDetail {
  parameterId: string;
  value: number;
  status: 'normal' | 'high' | 'low';
  appliedRange: { min: number; max: number } | null;
}

export interface OrderResult {
  id: string;
  orderId: string;
  testId: string;
  details: ResultDetail[];
  date: string;
}
