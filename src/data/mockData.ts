import { LabConfig, User, Patient, Reagent, InventoryMovement, LabTest, Order, OrderResult } from '@/types';

export const defaultLabConfig: LabConfig = {
  logo: '',
  name: 'Laboratorio Clínico BioAnalítica',
  owner: 'Dra. María Elena Rodríguez',
  address: 'Av. República E7-123 y Diego de Almagro, Quito',
  ruc: '1712345678001',
  healthRegistry: 'MSP-LC-2024-0456',
  phone: '+593 2 2567890',
  schedule: 'Lunes a Viernes 7:00 - 18:00 | Sábado 7:00 - 13:00',
};

export const mockUsers: User[] = [
  { id: '1', username: 'admin', password: 'admin123', role: 'admin', name: 'Dr. Carlos Mendoza' },
  { id: '2', username: 'lab1', password: 'lab123', role: 'laboratorist', name: 'Lcda. Ana García' },
];

export const mockPatients: Patient[] = [
  { id: 'p1', name: 'Juan Carlos Pérez', cedula: '1712345678', phone: '0991234567', email: 'juan@email.com', birthDate: '1990-05-15', sex: 'M' },
  { id: 'p2', name: 'María Fernanda López', cedula: '1723456789', phone: '0982345678', email: 'maria@email.com', birthDate: '1985-08-22', sex: 'F' },
  { id: 'p3', name: 'Pedro Antonio Ruiz', cedula: '1734567890', phone: '0973456789', email: 'pedro@email.com', birthDate: '2015-03-10', sex: 'M' },
  { id: 'p4', name: 'Lucía Esperanza Morales', cedula: '1745678901', phone: '0964567890', email: 'lucia@email.com', birthDate: '1972-11-30', sex: 'F' },
  { id: 'p5', name: 'Andrés Felipe Torres', cedula: '1756789012', phone: '0955678901', email: 'andres@email.com', birthDate: '2000-01-20', sex: 'M' },
];

export const mockReagents: Reagent[] = [
  { id: 'r1', name: 'Glucosa Oxidasa', code: 'RG-001', currentStock: 45, minStock: 10, expirationDate: '2025-12-30', supplier: 'Roche Diagnostics' },
  { id: 'r2', name: 'Reactivo Colesterol Total', code: 'RG-002', currentStock: 8, minStock: 10, expirationDate: '2025-10-15', supplier: 'Wiener Lab' },
  { id: 'r3', name: 'Triglicéridos Enzimático', code: 'RG-003', currentStock: 30, minStock: 10, expirationDate: '2026-01-20', supplier: 'Roche Diagnostics' },
  { id: 'r4', name: 'Hemoglobina Cianmeta', code: 'RG-004', currentStock: 5, minStock: 10, expirationDate: '2025-09-30', supplier: 'Biosystems' },
  { id: 'r5', name: 'Creatinina Jaffé', code: 'RG-005', currentStock: 22, minStock: 10, expirationDate: '2026-03-15', supplier: 'Wiener Lab' },
  { id: 'r6', name: 'Ácido Úrico Enzimático', code: 'RG-006', currentStock: 3, minStock: 10, expirationDate: '2025-11-20', supplier: 'Biosystems' },
  { id: 'r7', name: 'Urea UV Cinética', code: 'RG-007', currentStock: 18, minStock: 10, expirationDate: '2026-02-28', supplier: 'Roche Diagnostics' },
  { id: 'r8', name: 'TGO/AST Cinético', code: 'RG-008', currentStock: 12, minStock: 10, expirationDate: '2025-12-15', supplier: 'Wiener Lab' },
  { id: 'r9', name: 'TGP/ALT Cinético', code: 'RG-009', currentStock: 9, minStock: 10, expirationDate: '2026-01-10', supplier: 'Wiener Lab' },
  { id: 'r10', name: 'Diluyente Hematología', code: 'RG-010', currentStock: 50, minStock: 10, expirationDate: '2026-06-30', supplier: 'Sysmex' },
];

export const mockTests: LabTest[] = [
  {
    id: 't1', name: 'Glucosa en Ayunas', description: 'Determinación de glucosa en sangre', price: 5.00,
    parameters: [{
      id: 'tp1', testId: 't1', name: 'Glucosa', unit: 'mg/dL',
      ranges: [
        { id: 'rr1', parameterId: 'tp1', sex: 'both', minAge: 0, maxAge: 12, minValue: 60, maxValue: 100 },
        { id: 'rr2', parameterId: 'tp1', sex: 'both', minAge: 13, maxAge: 120, minValue: 70, maxValue: 110 },
      ]
    }],
    reagents: [{ reagentId: 'r1', quantityUsed: 1 }]
  },
  {
    id: 't2', name: 'Perfil Lipídico', description: 'Colesterol total, HDL, LDL, Triglicéridos', price: 18.00,
    parameters: [
      {
        id: 'tp2', testId: 't2', name: 'Colesterol Total', unit: 'mg/dL',
        ranges: [
          { id: 'rr3', parameterId: 'tp2', sex: 'both', minAge: 0, maxAge: 120, minValue: 0, maxValue: 200 },
        ]
      },
      {
        id: 'tp3', testId: 't2', name: 'HDL', unit: 'mg/dL',
        ranges: [
          { id: 'rr4', parameterId: 'tp3', sex: 'M', minAge: 0, maxAge: 120, minValue: 40, maxValue: 60 },
          { id: 'rr5', parameterId: 'tp3', sex: 'F', minAge: 0, maxAge: 120, minValue: 50, maxValue: 70 },
        ]
      },
      {
        id: 'tp4', testId: 't2', name: 'LDL', unit: 'mg/dL',
        ranges: [
          { id: 'rr6', parameterId: 'tp4', sex: 'both', minAge: 0, maxAge: 120, minValue: 0, maxValue: 130 },
        ]
      },
      {
        id: 'tp5', testId: 't2', name: 'Triglicéridos', unit: 'mg/dL',
        ranges: [
          { id: 'rr7', parameterId: 'tp5', sex: 'both', minAge: 0, maxAge: 120, minValue: 0, maxValue: 150 },
        ]
      },
    ],
    reagents: [{ reagentId: 'r2', quantityUsed: 1 }, { reagentId: 'r3', quantityUsed: 1 }]
  },
  {
    id: 't3', name: 'Biometría Hemática', description: 'Hemograma completo', price: 8.00,
    parameters: [
      {
        id: 'tp6', testId: 't3', name: 'Hemoglobina', unit: 'g/dL',
        ranges: [
          { id: 'rr8', parameterId: 'tp6', sex: 'M', minAge: 13, maxAge: 120, minValue: 13.5, maxValue: 17.5 },
          { id: 'rr9', parameterId: 'tp6', sex: 'F', minAge: 13, maxAge: 120, minValue: 12.0, maxValue: 16.0 },
          { id: 'rr10', parameterId: 'tp6', sex: 'both', minAge: 0, maxAge: 12, minValue: 11.0, maxValue: 14.5 },
        ]
      },
      {
        id: 'tp7', testId: 't3', name: 'Hematocrito', unit: '%',
        ranges: [
          { id: 'rr11', parameterId: 'tp7', sex: 'M', minAge: 13, maxAge: 120, minValue: 40, maxValue: 54 },
          { id: 'rr12', parameterId: 'tp7', sex: 'F', minAge: 13, maxAge: 120, minValue: 36, maxValue: 48 },
          { id: 'rr13', parameterId: 'tp7', sex: 'both', minAge: 0, maxAge: 12, minValue: 33, maxValue: 43 },
        ]
      },
      {
        id: 'tp8', testId: 't3', name: 'Leucocitos', unit: 'x10³/µL',
        ranges: [
          { id: 'rr14', parameterId: 'tp8', sex: 'both', minAge: 0, maxAge: 120, minValue: 4.5, maxValue: 11.0 },
        ]
      },
    ],
    reagents: [{ reagentId: 'r4', quantityUsed: 1 }, { reagentId: 'r10', quantityUsed: 2 }]
  },
  {
    id: 't4', name: 'Creatinina', description: 'Función renal - creatinina sérica', price: 5.00,
    parameters: [{
      id: 'tp9', testId: 't4', name: 'Creatinina', unit: 'mg/dL',
      ranges: [
        { id: 'rr15', parameterId: 'tp9', sex: 'M', minAge: 13, maxAge: 120, minValue: 0.7, maxValue: 1.3 },
        { id: 'rr16', parameterId: 'tp9', sex: 'F', minAge: 13, maxAge: 120, minValue: 0.6, maxValue: 1.1 },
        { id: 'rr17', parameterId: 'tp9', sex: 'both', minAge: 0, maxAge: 12, minValue: 0.3, maxValue: 0.7 },
      ]
    }],
    reagents: [{ reagentId: 'r5', quantityUsed: 1 }]
  },
  {
    id: 't5', name: 'Ácido Úrico', description: 'Determinación de ácido úrico sérico', price: 5.00,
    parameters: [{
      id: 'tp10', testId: 't5', name: 'Ácido Úrico', unit: 'mg/dL',
      ranges: [
        { id: 'rr18', parameterId: 'tp10', sex: 'M', minAge: 13, maxAge: 120, minValue: 3.4, maxValue: 7.0 },
        { id: 'rr19', parameterId: 'tp10', sex: 'F', minAge: 13, maxAge: 120, minValue: 2.4, maxValue: 5.7 },
      ]
    }],
    reagents: [{ reagentId: 'r6', quantityUsed: 1 }]
  },
  {
    id: 't6', name: 'Urea', description: 'Nitrógeno ureico en sangre', price: 5.00,
    parameters: [{
      id: 'tp11', testId: 't6', name: 'Urea', unit: 'mg/dL',
      ranges: [
        { id: 'rr20', parameterId: 'tp11', sex: 'both', minAge: 0, maxAge: 120, minValue: 15, maxValue: 45 },
      ]
    }],
    reagents: [{ reagentId: 'r7', quantityUsed: 1 }]
  },
  {
    id: 't7', name: 'TGO / AST', description: 'Transaminasa glutámico oxalacética', price: 6.00,
    parameters: [{
      id: 'tp12', testId: 't7', name: 'TGO/AST', unit: 'U/L',
      ranges: [
        { id: 'rr21', parameterId: 'tp12', sex: 'both', minAge: 0, maxAge: 120, minValue: 5, maxValue: 40 },
      ]
    }],
    reagents: [{ reagentId: 'r8', quantityUsed: 1 }]
  },
  {
    id: 't8', name: 'TGP / ALT', description: 'Transaminasa glutámico pirúvica', price: 6.00,
    parameters: [{
      id: 'tp13', testId: 't8', name: 'TGP/ALT', unit: 'U/L',
      ranges: [
        { id: 'rr22', parameterId: 'tp13', sex: 'both', minAge: 0, maxAge: 120, minValue: 5, maxValue: 40 },
      ]
    }],
    reagents: [{ reagentId: 'r9', quantityUsed: 1 }]
  },
];

export const mockOrders: Order[] = [
  { id: 'o1', code: 'ORD-2024-001', accessKey: 'ABC123', patientId: 'p1', testIds: ['t1', 't2'], total: 23.00, status: 'completed', date: '2024-11-01' },
  { id: 'o2', code: 'ORD-2024-002', accessKey: 'DEF456', patientId: 'p2', testIds: ['t3', 't4'], total: 13.00, status: 'completed', date: '2024-11-05' },
  { id: 'o3', code: 'ORD-2024-003', accessKey: 'GHI789', patientId: 'p3', testIds: ['t1'], total: 5.00, status: 'completed', date: '2024-11-10' },
  { id: 'o4', code: 'ORD-2024-004', accessKey: 'JKL012', patientId: 'p4', testIds: ['t5', 't6', 't7', 't8'], total: 22.00, status: 'in_progress', date: '2024-11-15' },
  { id: 'o5', code: 'ORD-2024-005', accessKey: 'MNO345', patientId: 'p5', testIds: ['t2', 't3'], total: 26.00, status: 'pending', date: '2024-11-20' },
];

export const mockResults: OrderResult[] = [
  {
    id: 'res1', orderId: 'o1', testId: 't1', date: '2024-11-01',
    details: [{ parameterId: 'tp1', value: 95, status: 'normal', appliedRange: { min: 70, max: 110 } }]
  },
  {
    id: 'res2', orderId: 'o1', testId: 't2', date: '2024-11-01',
    details: [
      { parameterId: 'tp2', value: 210, status: 'high', appliedRange: { min: 0, max: 200 } },
      { parameterId: 'tp3', value: 42, status: 'normal', appliedRange: { min: 40, max: 60 } },
      { parameterId: 'tp4', value: 140, status: 'high', appliedRange: { min: 0, max: 130 } },
      { parameterId: 'tp5', value: 120, status: 'normal', appliedRange: { min: 0, max: 150 } },
    ]
  },
  {
    id: 'res3', orderId: 'o2', testId: 't3', date: '2024-11-05',
    details: [
      { parameterId: 'tp6', value: 13.2, status: 'normal', appliedRange: { min: 12.0, max: 16.0 } },
      { parameterId: 'tp7', value: 39, status: 'normal', appliedRange: { min: 36, max: 48 } },
      { parameterId: 'tp8', value: 6.5, status: 'normal', appliedRange: { min: 4.5, max: 11.0 } },
    ]
  },
  {
    id: 'res4', orderId: 'o2', testId: 't4', date: '2024-11-05',
    details: [{ parameterId: 'tp9', value: 0.9, status: 'normal', appliedRange: { min: 0.6, max: 1.1 } }]
  },
  {
    id: 'res5', orderId: 'o3', testId: 't1', date: '2024-11-10',
    details: [{ parameterId: 'tp1', value: 55, status: 'low', appliedRange: { min: 60, max: 100 } }]
  },
];

export const mockMovements: InventoryMovement[] = [
  { id: 'm1', reagentId: 'r1', type: 'entry', quantity: 20, date: '2024-10-01', reason: 'Compra mensual' },
  { id: 'm2', reagentId: 'r2', type: 'exit', quantity: 5, date: '2024-10-15', reason: 'Consumo pruebas' },
  { id: 'm3', reagentId: 'r4', type: 'exit', quantity: 10, date: '2024-11-01', reason: 'Consumo pruebas' },
  { id: 'm4', reagentId: 'r6', type: 'exit', quantity: 7, date: '2024-11-05', reason: 'Consumo pruebas' },
];
