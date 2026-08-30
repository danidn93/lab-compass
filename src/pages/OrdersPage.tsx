import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { sendDocumentEmail } from '@/lib/sendDocumentEmail';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  Plus,
  Search,
  Printer,
  FileText,
  Receipt,
  FileCode,
  RefreshCw,
  UserPlus,
  Wallet,
  Stethoscope,
} from 'lucide-react';
import { toast } from 'sonner';
import QRCode from 'qrcode';

function safeNumber(value: any, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function obtenerCodigoPorcentajeIva(porcentaje: number): string {
  const p = Number(porcentaje);

  if (p === 0) return '0';
  if (p === 12) return '2';
  if (p === 14) return '3';
  if (p === 15) return '4';
  if (p === 5) return '5';
  if (p === 13) return '10';

  throw new Error(`Tarifa IVA no soportada: ${p}%`);
}

function normalizeExamName(value: any) {
  return String(value || '').trim().toLowerCase();
}

function normalizeExamDescription(
  description: any,
  visibleDescription: boolean | null | undefined
) {
  if (visibleDescription === false) return '';
  return String(description || '').trim().toLowerCase();
}

function buildGroupedTestKey(
  name: any,
  description: any,
  visibleDescription: boolean | null | undefined
) {
  return `${normalizeExamName(name)}|||${normalizeExamDescription(
    description,
    visibleDescription
  )}`;
}

function getSortedParameterNamesFromTest(test: any) {
  return [...(test?.parametros_prueba || [])]
    .map((p: any) => String(p?.name || '').trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
}

function buildVariantLabelFromTest(test: any, showParameters: boolean) {
  const visibleDescription = test?.visible_description ?? true;
  const description = visibleDescription
    ? String(test?.description || '').trim()
    : '';

  const parameterNames = getSortedParameterNamesFromTest(test);

  if (showParameters && parameterNames.length > 0) {
    return parameterNames.join(', ');
  }

  if (description) {
    return description;
  }

  return '';
}

function groupOrderDetailsForTicket(detalles: any[] = []) {
  const groupedMap: Record<string, any> = {};

  for (const detalle of detalles) {
    const prueba = detalle?.pruebas || {};
    const visibleDescription = prueba?.visible_description ?? true;

    const key = buildGroupedTestKey(
      prueba?.name,
      prueba?.description,
      visibleDescription
    );

    if (!groupedMap[key]) {
      groupedMap[key] = {
        name: String(prueba?.name || 'Prueba'),
        description: visibleDescription ? String(prueba?.description || '') : '',
        visible_description: visibleDescription,
        items: [],
      };
    }

    groupedMap[key].items.push(detalle);
  }

  return Object.values(groupedMap)
    .map((group: any) => {
      const isGrouped = group.items.length > 1;

      const items = [...group.items].sort((a: any, b: any) => {
        const aLabel = buildVariantLabelFromTest(a?.pruebas || {}, isGrouped);
        const bLabel = buildVariantLabelFromTest(b?.pruebas || {}, isGrouped);

        return aLabel.localeCompare(bLabel, 'es', { sensitivity: 'base' });
      });

      return {
        ...group,
        items,
      };
    })
    .sort((a: any, b: any) => {
      const byName = String(a.name || '').localeCompare(String(b.name || ''), 'es', {
        sensitivity: 'base',
      });

      if (byName !== 0) return byName;

      return String(a.description || '').localeCompare(
        String(b.description || ''),
        'es',
        { sensitivity: 'base' }
      );
    });
}

type LabConfig = {
  id?: string;
  logo?: string | null;
  name?: string | null;
  owner?: string | null;
  address?: string | null;
  ruc?: string | null;
  health_registry?: string | null;
  phone?: string | null;
  schedule?: string | null;
  legal_name?: string | null;
  email?: string | null;
};
type GlobalDiscountType = 'VALUE' | 'PERCENT';
type OrderWizardStep = 1 | 2 | 3;
type PaymentFormType = {
  amount: string;
  payment_method: string;
  reference: string;
  notes: string;
};

type BillingMode = 'PACIENTE' | 'CONSUMIDOR_FINAL' | 'OTRO';
type BillingIdType = 'CEDULA' | 'RUC' | 'PASAPORTE' | 'CONSUMIDOR_FINAL';

type BillingFormType = {
  tipo_identificacion: BillingIdType;
  identificacion: string;
  nombres: string;
  direccion: string;
  telefono: string;
  email: string;
};

type DoctorForm = {
  nombre: string;
  especialidad: string;
  telefono: string;
  email: string;
  activo: boolean;
};

const initialDoctorForm: DoctorForm = {
  nombre: '',
  especialidad: '',
  telefono: '',
  email: '',
  activo: true,
};

function normalizeBillingIdType(value: any): BillingIdType {
  if (
    value === 'CEDULA' ||
    value === 'RUC' ||
    value === 'PASAPORTE' ||
    value === 'CONSUMIDOR_FINAL'
  ) {
    return value;
  }
  return 'CEDULA';
}

const CONSUMIDOR_FINAL_DATA: BillingFormType = {
  tipo_identificacion: 'CONSUMIDOR_FINAL',
  identificacion: '9999999999999',
  nombres: 'CONSUMIDOR FINAL',
  direccion: 'S/N',
  telefono: '9999999999',
  email: '',
};

function normalizeExamText(value: any): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function capitalizeExamName(value: string): string {
  const keepUpper = new Set([
    'HIV', 'TSH', 'LH', 'FSH', 'HCG', 'BUN', 'HDL', 'LDL', 'LDH', 'CK', 'NAC',
    'MB', 'GGT', 'CA', 'C3', 'C4', 'IGG', 'IGM', 'IGA', 'IGE', 'TGO', 'TGP',
    'VCM', 'HCM', 'CHCM', 'RH', 'T3', 'T4', 'P24', 'ASTO', 'VDRL',
  ]);

  return String(value || '')
    .trim()
    .toLocaleLowerCase('es-EC')
    .replace(/(^|[\s(/-])([\p{L}\p{N}])/gu, (_, prefix, letter) =>
      `${prefix}${letter.toLocaleUpperCase('es-EC')}`
    )
    .split(' ')
    .map((word) => {
      const clean = normalizeExamText(word).replace(/ /g, '');
      return keepUpper.has(clean) ? clean : word;
    })
    .join(' ');
}

function getOrderPickerTestLabel(test: any): string {
  const rawTestName = String(test?.name || '').trim();
  const rawDescription = String(test?.description || '').trim();
  const normalizedTestName = normalizeExamText(rawTestName);
  const normalizedDescription = normalizeExamText(rawDescription);

  if (
    normalizedTestName.includes('INVESTIGACION DE ANTICUERPOS Y ANTIGENO P24 HIV') ||
    normalizedDescription.includes('INVESTIGACION DE ANTICUERPOS Y ANTIGENO P24 HIV') ||
    normalizedTestName.includes('HIV SIDA DE CUARTA GENERACION') ||
    normalizedDescription.includes('HIV SIDA DE CUARTA GENERACION')
  ) {
    return 'HIV';
  }

  const parametros = [...(test?.parametros_prueba || [])].sort(
    (a: any, b: any) => safeNumber(a?.sort_order, 0) - safeNumber(b?.sort_order, 0)
  );

  if (parametros.length === 1) {
    const parameterName = String(parametros[0]?.name || '').trim();
    if (parameterName) return capitalizeExamName(parameterName);
  }

  return capitalizeExamName(rawTestName || 'Prueba');
}

type ExamSectionKey =
  | 'HEMATOLOGICOS'
  | 'HEMOSTASIA'
  | 'INMUNOLOGICOS'
  | 'INMUNOGLOBULINAS'
  | 'BIOQUIMICOS'
  | 'ENZIMAS'
  | 'MARCADORES_TUMORALES'
  | 'ELECTROLITOS'
  | 'FERTILIDAD_HORMONAS'
  | 'BACTERIOLOGICOS'
  | 'ORINA'
  | 'HECES'
  | 'OTROS_EXAMENES';

type ExamCatalogItem = {
  label: string;
  aliases?: string[];
};

type ExamSectionDefinition = {
  key: ExamSectionKey;
  title: string;
  column: 1 | 2 | 3;
  items: ExamCatalogItem[];
};

const EXAM_SECTIONS: ExamSectionDefinition[] = [
  {
    key: 'HEMATOLOGICOS', title: 'HEMATOLÓGICOS', column: 1,
    items: [
      { label: 'Hemograma Completo', aliases: ['HEMOGRAMA', 'BIOMETRIA HEMATICA'] },
      { label: 'Plaquetas', aliases: ['PLAQUETAS'] },
      { label: 'Reticulocitos', aliases: ['RETICULOCITOS'] },
      { label: 'Eritrosedimentación', aliases: ['ERITROSEDIMENTACION', 'VELOCIDAD DE SEDIMENTACION', 'VSG'] },
      { label: 'Grupo Sanguíneo', aliases: ['GRUPO SANGUINEO', 'GRUPO SANGUINEO Y FACTOR RH'] },
      { label: 'Factor Rh', aliases: ['FACTOR RH', 'RH'] },
      { label: 'Plasmodium', aliases: ['PLASMODIUM'] },
      { label: 'Constantes VCM', aliases: ['CONSTANTES VCM', 'VCM'] },
      { label: 'Corpusculares HCM', aliases: ['CORPUSCULARES HCM', 'HCM'] },
      { label: 'Corpusculares CHCM', aliases: ['CORPUSCULARES CHCM', 'CHCM'] },
    ],
  },
  {
    key: 'HEMOSTASIA', title: 'HEMOSTASIA', column: 1,
    items: [
      { label: 'T. Sangría', aliases: ['T SANGRIA', 'TIEMPO DE SANGRIA'] },
      { label: 'T. Coagulación', aliases: ['T COAGULACION', 'TIEMPO DE COAGULACION'] },
      { label: 'T. Protrombina', aliases: ['T PROTROMBINA', 'TIEMPO DE PROTROMBINA', 'TP'] },
      { label: 'T.P Tromboplastina', aliases: ['T P TROMBOPLASTINA', 'TROMBOPLASTINA', 'TTP', 'TTPA'] },
      { label: 'Fibrinógeno', aliases: ['FIBRINOGENO'] },
    ],
  },
  {
    key: 'INMUNOLOGICOS', title: 'INMUNOLÓGICOS', column: 1,
    items: [
      { label: 'R. de Widal', aliases: ['R DE WIDAL', 'REACCION DE WIDAL', 'WIDAL'] },
      { label: 'R. Weil Félix', aliases: ['R WEIL FELIX', 'WEIL FELIX'] },
      { label: 'Proteína C. Reactiva', aliases: ['PROTEINA C REACTIVA', 'PCR'] },
      { label: 'R. A. Test', aliases: ['R A TEST', 'RA TEST'] },
      { label: 'A.S.T.O.', aliases: ['A S T O', 'ASTO', 'ANTI ESTREPTOLISINA O'] },
      { label: 'V.D.R.L.', aliases: ['V D R L', 'VDRL'] },
      { label: 'Factor Reumatoideo', aliases: ['FACTOR REUMATOIDEO', 'FACTOR REUMATOIDE'] },
      { label: 'Ac. Anti Dengue IgG', aliases: ['AC ANTI DENGUE IGG', 'DENGUE IGG'] },
      { label: 'Ac. Anti Dengue IgM', aliases: ['AC ANTI DENGUE IGM', 'DENGUE IGM'] },
      { label: 'Toxoplasma IgG', aliases: ['TOXOPLASMA IGG', 'TOXOPLASMOSIS IGG'] },
      { label: 'Toxoplasma IgM', aliases: ['TOXOPLASMA IGM', 'TOXOPLASMOSIS IGM'] },
      { label: 'Rubéola IgG', aliases: ['RUBEOLA IGG'] },
      { label: 'Rubéola IgM', aliases: ['RUBEOLA IGM'] },
      { label: 'Seroameba', aliases: ['SEROAMEBA', 'AMEBA'] },
      { label: 'Helicobacter Pylori', aliases: ['HELICOBACTER PYLORI'] },
      { label: 'Citomegalovirus IgG', aliases: ['CITOMEGALOVIRUS IGG', 'CMV IGG'] },
      { label: 'Citomegalovirus IgM', aliases: ['CITOMEGALOVIRUS IGM', 'CMV IGM'] },
      { label: 'Chlamydias', aliases: ['CHLAMYDIAS', 'CLAMIDIA', 'CHLAMYDIA'] },
      { label: 'Herpes I', aliases: ['HERPES I', 'HERPES 1', 'HERPES SIMPLEX 1'] },
      { label: 'Herpes II', aliases: ['HERPES II', 'HERPES 2', 'HERPES SIMPLEX 2'] },
      { label: 'HIV', aliases: ['HIV', 'VIH', 'ANTIGENO P24 HIV', 'HIV SIDA DE CUARTA GENERACION'] },
      { label: 'Test de Mononucleosis', aliases: ['TEST DE MONONUCLEOSIS', 'MONONUCLEOSIS'] },
      { label: 'Complemento C3 - C4', aliases: ['COMPLEMENTO C3 C4', 'C3 C4'] },
      { label: 'Hepatitis A', aliases: ['HEPATITIS A'] },
      { label: 'HbsAg (Superficie)', aliases: ['HBSAG', 'HBS AG', 'ANTIGENO DE SUPERFICIE HEPATITIS B'] },
      { label: 'Hepatitis C', aliases: ['HEPATITIS C'] },
      { label: 'Hepatitis D', aliases: ['HEPATITIS D'] },
    ],
  },
  {
    key: 'INMUNOGLOBULINAS', title: 'INMUNOGLOBULINAS', column: 1,
    items: [
      { label: 'IgG', aliases: ['IGG', 'INMUNOGLOBULINA G'] },
      { label: 'IgE', aliases: ['IGE', 'INMUNOGLOBULINA E'] },
      { label: 'IgA', aliases: ['IGA', 'INMUNOGLOBULINA A'] },
      { label: 'IgM', aliases: ['IGM', 'INMUNOGLOBULINA M'] },
    ],
  },
  {
    key: 'BIOQUIMICOS', title: 'BIOQUÍMICOS', column: 2,
    items: [
      { label: 'Glicemia (Ayunas)', aliases: ['GLICEMIA AYUNAS', 'GLUCOSA AYUNAS', 'GLICEMIA EN AYUNAS'] },
      { label: 'Glicemia (P. Prandial)', aliases: ['GLICEMIA P PRANDIAL', 'GLICEMIA POST PRANDIAL', 'GLUCOSA POSTPRANDIAL'] },
      { label: 'Glicemia (Tolerancia)', aliases: ['GLICEMIA TOLERANCIA', 'TOLERANCIA A LA GLUCOSA'] },
      { label: 'Urea', aliases: ['UREA'] },
      { label: 'Creatinina', aliases: ['CREATININA'] },
      { label: 'Ácido Úrico', aliases: ['ACIDO URICO'] },
      { label: 'BUN', aliases: ['BUN', 'NITROGENO UREICO'] },
      { label: 'Hierro Sérico', aliases: ['HIERRO SERICO', 'HIERRO'] },
      { label: 'Proteínas Tot.', aliases: ['PROTEINAS TOT', 'PROTEINAS TOTALES'] },
      { label: 'Sero Albúminas', aliases: ['SERO ALBUMINAS', 'ALBUMINA', 'ALBUMINAS'] },
      { label: 'Sero Globulinas', aliases: ['SERO GLOBULINAS', 'GLOBULINAS'] },
      { label: 'Bilirrubina Tot.', aliases: ['BILIRRUBINA TOT', 'BILIRRUBINA TOTAL'] },
      { label: 'Bilirrubina Directa', aliases: ['BILIRRUBINA DIRECTA'] },
      { label: 'Bilirrubina Indirecta', aliases: ['BILIRRUBINA INDIRECTA'] },
      { label: 'Colesterol', aliases: ['COLESTEROL', 'COLESTEROL TOTAL'] },
      { label: 'HDL Colesterol', aliases: ['HDL COLESTEROL', 'COLESTEROL HDL'] },
      { label: 'LDL Colesterol', aliases: ['LDL COLESTEROL', 'COLESTEROL LDL'] },
      { label: 'Triglicéridos', aliases: ['TRIGLICERIDOS'] },
      { label: 'Lípidos Totales', aliases: ['LIPIDOS TOTALES'] },
    ],
  },
  {
    key: 'ENZIMAS', title: 'ENZIMAS', column: 2,
    items: [
      { label: 'T.G.O.', aliases: ['T G O', 'TGO', 'AST'] },
      { label: 'T.G.P.', aliases: ['T G P', 'TGP', 'ALT'] },
      { label: 'L.D.H.', aliases: ['L D H', 'LDH', 'DESHIDROGENASA LACTICA'] },
      { label: 'C.K. NAC.', aliases: ['C K NAC', 'CK NAC', 'CK TOTAL'] },
      { label: 'C.K. MB.', aliases: ['C K MB', 'CK MB', 'CKMB'] },
      { label: 'Gamma G.T.', aliases: ['GAMMA G T', 'GGT', 'GAMMA GLUTAMIL TRANSFERASA'] },
      { label: 'Fosfatasa Alcalina', aliases: ['FOSFATASA ALCALINA'] },
      { label: 'Fosfatasa Ácida', aliases: ['FOSFATASA ACIDA'] },
      { label: 'Fosfatasa Ácida Prostática', aliases: ['FOSFATASA ACIDA PROSTATICA'] },
      { label: 'Colinesterasa', aliases: ['COLINESTERASA'] },
      { label: 'Lipasa', aliases: ['LIPASA'] },
      { label: 'Amilasa', aliases: ['AMILASA'] },
    ],
  },
  {
    key: 'MARCADORES_TUMORALES', title: 'MARCADORES TUMORALES', column: 2,
    items: [
      { label: 'Alfa Fetoproteínas', aliases: ['ALFA FETOPROTEINAS', 'AFP'] },
      { label: 'Antíg. Carcinoembrionario', aliases: ['ANTIG CARCINOEMBRIONARIO', 'ANTIGENO CARCINOEMBRIONARIO', 'CEA'] },
      { label: 'Antíg. Prostático Específico', aliases: ['ANTIG PROSTATICO ESPECIFICO', 'ANTIGENO PROSTATICO ESPECIFICO', 'PSA'] },
      { label: 'CA - 125 (Útero-Ovario)', aliases: ['CA 125', 'CA125'] },
      { label: 'CA - 15-3 (Mamas)', aliases: ['CA 15 3', 'CA15 3'] },
      { label: 'CA - 19-9 (T. Digestivo)', aliases: ['CA 19 9', 'CA19 9'] },
      { label: 'CA - 72-4 (T. Digestivo)', aliases: ['CA 72 4', 'CA72 4'] },
      { label: 'Cyfra 21-1 (Pulmón)', aliases: ['CYFRA 21 1', 'CYFRA21 1'] },
    ],
  },
  {
    key: 'ELECTROLITOS', title: 'ELECTROLITOS', column: 2,
    items: [
      { label: 'Sodio', aliases: ['SODIO', 'NA'] },
      { label: 'Potasio', aliases: ['POTASIO'] },
      { label: 'Calcio', aliases: ['CALCIO'] },
      { label: 'Cloro', aliases: ['CLORO', 'CLORURO'] },
    ],
  },
  {
    key: 'FERTILIDAD_HORMONAS', title: 'FERTILIDAD Y HORMONAS', column: 3,
    items: [
      { label: 'Espermatograma', aliases: ['ESPERMATOGRAMA'] },
      { label: 'T3 Total', aliases: ['T3 TOTAL'] },
      { label: 'T3 Libre', aliases: ['T3 LIBRE'] },
      { label: 'T4 Total', aliases: ['T4 TOTAL'] },
      { label: 'T4 Libre', aliases: ['T4 LIBRE'] },
      { label: 'TSH', aliases: ['TSH', 'HORMONA ESTIMULANTE DE TIROIDES'] },
      { label: 'LH', aliases: ['LH', 'HORMONA LUTEINIZANTE'] },
      { label: 'FSH', aliases: ['FSH', 'HORMONA FOLICULO ESTIMULANTE'] },
      { label: 'Prolactina', aliases: ['PROLACTINA'] },
      { label: 'Progesterona', aliases: ['PROGESTERONA'] },
      { label: '17 β-Estradiol', aliases: ['17 B ESTRADIOL', '17 BETA ESTRADIOL', 'ESTRADIOL'] },
      { label: 'Testosterona', aliases: ['TESTOSTERONA'] },
      { label: 'Cortisol', aliases: ['CORTISOL'] },
      { label: 'HCG β-Cualitativo (Embarazo)', aliases: ['HCG B CUALITATIVO', 'HCG BETA CUALITATIVO', 'BETA HCG CUALITATIVO'] },
      { label: 'HCG β-Cuantitativo', aliases: ['HCG B CUANTITATIVO', 'HCG BETA CUANTITATIVO', 'BETA HCG CUANTITATIVO'] },
    ],
  },
  {
    key: 'BACTERIOLOGICOS', title: 'BACTERIOLÓGICOS', column: 3,
    items: [
      { label: 'Exudado Faríngeo', aliases: ['EXUDADO FARINGEO'] },
      { label: 'Hemocultivo', aliases: ['HEMOCULTIVO'] },
      { label: 'Urocultivo', aliases: ['UROCULTIVO'] },
      { label: 'Coprocultivo', aliases: ['COPROCULTIVO'] },
      { label: 'Secreción Vaginal', aliases: ['SECRECION VAGINAL'] },
      { label: 'Secreción Uretral', aliases: ['SECRECION URETRAL'] },
      { label: 'Esputo', aliases: ['ESPUTO', 'CULTIVO DE ESPUTO'] },
    ],
  },
  {
    key: 'ORINA', title: 'ORINA', column: 3,
    items: [
      { label: 'Fís. Quím. Sedimento', aliases: ['FIS QUIM SEDIMENTO', 'FISICO QUIMICO SEDIMENTO', 'EXAMEN DE ORINA', 'ELEMENTAL Y MICROSCOPICO DE ORINA'] },
      { label: 'Test de Embarazo', aliases: ['TEST DE EMBARAZO', 'PRUEBA DE EMBARAZO'] },
      { label: 'Depuración de Creatinina 24h', aliases: ['DEPURACION DE CREATININA 24H', 'CLEARANCE DE CREATININA'] },
    ],
  },
  {
    key: 'HECES', title: 'HECES', column: 3,
    items: [
      { label: 'Parasitológico', aliases: ['PARASITOLOGICO', 'COPROPARASITARIO'] },
      { label: 'Sangre Oculta', aliases: ['SANGRE OCULTA', 'SANGRE OCULTA EN HECES'] },
      { label: 'Estudio de Moco Fecal', aliases: ['ESTUDIO DE MOCO FECAL', 'MOCO FECAL'] },
      { label: 'Coprocultivo', aliases: ['COPROCULTIVO'] },
      { label: 'Helicobacter Pylori en Heces', aliases: ['HELICOBACTER PYLORI EN HECES', 'H PYLORI EN HECES'] },
    ],
  },
  { key: 'OTROS_EXAMENES', title: 'OTROS EXÁMENES', column: 3, items: [] },
];

function getExamCatalogPlacement(test: any): {
  sectionKey: ExamSectionKey;
  sectionTitle: string;
  column: 1 | 2 | 3;
  order: number;
  label: string;
} {
  const pickerLabel = getOrderPickerTestLabel(test);
  const candidates = [
    pickerLabel,
    test?.name,
    test?.description,
    ...(Array.isArray(test?.parametros_prueba)
      ? test.parametros_prueba.map((p: any) => p?.name)
      : []),
  ]
    .map(normalizeExamText)
    .filter(Boolean);

  for (const section of EXAM_SECTIONS) {
    if (section.key === 'OTROS_EXAMENES') continue;

    for (let index = 0; index < section.items.length; index += 1) {
      const item = section.items[index];
      const aliases = [item.label, ...(item.aliases || [])].map(normalizeExamText);
      const matches = candidates.some((candidate) =>
        aliases.some((alias) =>
          candidate === alias ||
          (alias.length >= 5 && candidate.includes(alias)) ||
          (candidate.length >= 5 && alias.includes(candidate))
        )
      );

      if (matches) {
        return {
          sectionKey: section.key,
          sectionTitle: section.title,
          column: section.column,
          order: index,
          label: item.label === 'HIV' ? 'HIV' : capitalizeExamName(item.label),
        };
      }
    }
  }

  return {
    sectionKey: 'OTROS_EXAMENES',
    sectionTitle: 'OTROS EXÁMENES',
    column: 3,
    order: Number.MAX_SAFE_INTEGER,
    label: pickerLabel,
  };
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [labConfig, setLabConfig] = useState<LabConfig | null>(null);

  const [initialPaymentForm, setInitialPaymentForm] = useState<PaymentFormType>({
    amount: '',
    payment_method: 'EFECTIVO',
    reference: '',
    notes: '',
  });

  const [orderWizardStep, setOrderWizardStep] = useState<OrderWizardStep>(1);
  const [globalDiscountType, setGlobalDiscountType] = useState<GlobalDiscountType>('VALUE');
  const [globalDiscount, setGlobalDiscount] = useState('');

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [creatingPatient, setCreatingPatient] = useState(false);
  const [checkingSri, setCheckingSri] = useState<string | null>(null);
  const [savingPayment, setSavingPayment] = useState(false);
  const [generatingRide, setGeneratingRide] = useState<string | null>(null);
  const [billingLookupLoading, setBillingLookupLoading] = useState(false);
  const [savingDoctor, setSavingDoctor] = useState(false);

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [patientDialogOpen, setPatientDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [doctorDialogOpen, setDoctorDialogOpen] = useState(false);

  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [paymentOrder, setPaymentOrder] = useState<any>(null);

  const [selectedPatient, setSelectedPatient] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [testSearch, setTestSearch] = useState('');

  const [billingMode, setBillingMode] = useState<BillingMode>('PACIENTE');
  const [billingCustomerId, setBillingCustomerId] = useState<string | null>(null);
  const [billingFoundMessage, setBillingFoundMessage] = useState('');
  const [billingForm, setBillingForm] = useState<BillingFormType>({
    tipo_identificacion: 'CEDULA',
    identificacion: '',
    nombres: '',
    direccion: '',
    telefono: '',
    email: '',
  });

  const [patientForm, setPatientForm] = useState({
    name: '',
    cedula: '',
    phone: '',
    email: '',
    birth_date: '',
    sex: 'M' as 'M' | 'F',
    direccion: '',
  });

  const [doctorForm, setDoctorForm] = useState<DoctorForm>(initialDoctorForm);

  const [paymentForm, setPaymentForm] = useState<PaymentFormType>({
    amount: '',
    payment_method: 'EFECTIVO',
    reference: '',
    notes: '',
  });

  const [assignDoctorDialogOpen, setAssignDoctorDialogOpen] = useState(false);
  const [assigningDoctor, setAssigningDoctor] = useState(false);
  const [doctorOrder, setDoctorOrder] = useState<any>(null);
  const [doctorToAssign, setDoctorToAssign] = useState('');

  const openAssignDoctorDialog = async (orderId: string) => {
    try {
      const { data: order, error } = await supabase
        .from('ordenes')
        .select(`
          *,
          pacientes(name, cedula, email),
          doctores(nombre, especialidad),
          orden_pagos(*)
        `)
        .eq('id', orderId)
        .single();

      if (error || !order) {
        toast.error('No se pudo cargar la orden');
        return;
      }

      setDoctorOrder(order);
      setDoctorToAssign(order.doctor_id || '');
      setAssignDoctorDialogOpen(true);
    } catch (error: any) {
      toast.error('Error al cargar la orden: ' + error.message);
    }
  };

  const handleAssignDoctorToOrder = async () => {
    if (!doctorOrder) return;

    try {
      setAssigningDoctor(true);

      const { error } = await supabase
        .from('ordenes')
        .update({
          doctor_id: doctorToAssign || null,
        })
        .eq('id', doctorOrder.id);

      if (error) throw error;

      toast.success(
        doctorToAssign ? 'Médico asignado correctamente' : 'Médico removido correctamente'
      );

      await fetchInitialData();

      const { data: updatedOrder } = await supabase
        .from('ordenes')
        .select(`
          *,
          pacientes(name, cedula, email),
          doctores(nombre, especialidad),
          orden_pagos(*),
          orden_detalle(
            test_id,
            price,
            subtotal_sin_impuesto,
            valor_iva,
            total_linea,
            porcentaje_iva,
            pruebas(name, price)
          )
        `)
        .eq('id', doctorOrder.id)
        .single();

      if (updatedOrder) {
        setDoctorOrder(updatedOrder);

        if (selectedOrder?.id === updatedOrder.id) {
          setSelectedOrder(updatedOrder);
        }

        if (paymentOrder?.id === updatedOrder.id) {
          setPaymentOrder(updatedOrder);
        }
      }

      setAssignDoctorDialogOpen(false);
    } catch (error: any) {
      toast.error('Error al guardar médico en la orden: ' + error.message);
    } finally {
      setAssigningDoctor(false);
    }
  };
  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (billingMode === 'CONSUMIDOR_FINAL') {
      setBillingCustomerId(null);
      setBillingFoundMessage('');
      setBillingForm(CONSUMIDOR_FINAL_DATA);
      return;
    }

    if (billingMode === 'PACIENTE') {
      const p = patients.find((x) => x.id === selectedPatient);
      setBillingCustomerId(null);
      setBillingFoundMessage('');

      if (p) {
        setBillingForm({
          tipo_identificacion: 'CEDULA',
          identificacion: String(p.cedula || '').trim(),
          nombres: String(p.name || '').trim(),
          direccion: String(p.direccion || '').trim(),
          telefono: String(p.phone || '').trim(),
          email: String(p.email || '').trim(),
        });
      } else {
        setBillingForm({
          tipo_identificacion: 'CEDULA',
          identificacion: '',
          nombres: '',
          direccion: '',
          telefono: '',
          email: '',
        });
      }
    }
  }, [billingMode, selectedPatient, patients]);

  const fetchDoctors = async () => {
    const { data, error } = await supabase
      .from('doctores')
      .select('*')
      .eq('activo', true)
      .order('nombre');

    if (error) throw error;

    setDoctors(data || []);
    return data || [];
  };

  const fetchInitialData = async () => {
    try {
      setLoading(true);

      const [o, p, t, c, d] = await Promise.all([
        supabase
          .from('ordenes')
          .select(`
            *,
            pacientes(name, cedula, email),
            doctores(nombre, especialidad),
            orden_pagos(*)
          `)
          .order('created_at', { ascending: false }),

        supabase.from('pacientes').select('*').order('name'),

        supabase
          .from('pruebas')
          .select(`
            *,
            prueba_reactivos(*),
            parametros_prueba(
              id,
              name,
              unit,
              result_type,
              sort_order
            )
          `)
          .order('name'),

        supabase
          .from('configuracion_laboratorio')
          .select(`
            id,
            logo,
            name,
            owner,
            address,
            ruc,
            health_registry,
            phone,
            schedule,
            legal_name,
            email
          `)
          .maybeSingle(),

        supabase
          .from('doctores')
          .select('*')
          .eq('activo', true)
          .order('nombre'),
      ]);

      if (o.error) throw o.error;
      if (p.error) throw p.error;
      if (t.error) throw t.error;
      if (c.error) throw c.error;
      if (d.error) throw d.error;

      setOrders(o.data || []);
      setPatients(p.data || []);
      setTests(t.data || []);
      setLabConfig(c.data || null);
      setDoctors(d.data || []);
    } catch (error: any) {
      toast.error('Error al cargar datos: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const generateAccessKey = () =>
    Math.random().toString(36).substring(2, 8).toUpperCase();

  const generateOrderCode = () => `ORD-${Date.now().toString().slice(-6)}`;

  const selectedPatientData = useMemo(() => {
    return patients.find((p) => p.id === selectedPatient) || null;
  }, [patients, selectedPatient]);

  const getBaseSubtotalOfSelectedTests = () => {
    return round2(
      selectedTests.reduce((acc, testId) => {
        const test = tests.find((t) => t.id === testId);
        return acc + safeNumber(test?.price, 0);
      }, 0)
    );
  };

  const filteredPatients = useMemo(() => {
    const q = patientSearch.trim().toLowerCase();
    if (!q) return [];

    return patients.filter((p) => {
      const nombre = String(p.name || '').toLowerCase();
      const cedula = String(p.cedula || '').toLowerCase();
      const email = String(p.email || '').toLowerCase();

      return nombre.includes(q) || cedula.includes(q) || email.includes(q);
    });
  }, [patients, patientSearch]);

  const filteredTestsForPicker = useMemo(() => {
    const q = normalizeExamText(testSearch);

    return tests
      .map((test) => {
        const placement = getExamCatalogPlacement(test);
        return { ...test, pickerPlacement: placement };
      })
      .filter((test) => {
        if (!q) return true;

        const searchable = [
          test.pickerPlacement.label,
          test.name,
          test.description,
          ...(Array.isArray(test.parametros_prueba)
            ? test.parametros_prueba.map((param: any) => param?.name)
            : []),
        ]
          .map(normalizeExamText)
          .filter(Boolean);

        return searchable.some((value) => value.includes(q));
      });
  }, [tests, testSearch]);

  const groupedTestsForPicker = useMemo(() => {
    return ([1, 2, 3] as const).map((column) => ({
      column,
      sections: EXAM_SECTIONS
        .filter((section) => section.column === column)
        .map((section) => {
          const sectionTests = filteredTestsForPicker
            .filter((test: any) => test.pickerPlacement.sectionKey === section.key)
            .sort((a: any, b: any) => {
              const byOrder = a.pickerPlacement.order - b.pickerPlacement.order;
              if (byOrder !== 0) return byOrder;
              return a.pickerPlacement.label.localeCompare(b.pickerPlacement.label, 'es', {
                sensitivity: 'base',
              });
            });

          return { ...section, tests: sectionTests };
        })
        .filter((section) => section.tests.length > 0),
    }));
  }, [filteredTestsForPicker]);

  const selectedTestsSummary = useMemo(() => {
    const baseSubtotal = round2(
      selectedTests.reduce((acc, testId) => {
        const test = tests.find((t) => t.id === testId);
        return acc + safeNumber(test?.price, 0);
      }, 0)
    );

    const enteredDiscount = Math.max(safeNumber(globalDiscount, 0), 0);
    const appliedGlobalDiscount =
      globalDiscountType === 'PERCENT'
        ? round2(
            Math.min(
              baseSubtotal * (Math.min(enteredDiscount, 100) / 100),
              baseSubtotal
            )
          )
        : round2(Math.min(enteredDiscount, baseSubtotal));

    let allocatedDiscount = 0;

    return selectedTests
      .map((tid, index) => {
        const test = tests.find((t) => t.id === tid);
        if (!test) return null;

        const precio = round2(safeNumber(test.price));
        const porcentajeIva = round2(safeNumber(test.porcentaje_iva, 0));

        const isLast = index === selectedTests.length - 1;
        const proportionalDiscount =
          baseSubtotal > 0 ? round2(appliedGlobalDiscount * (precio / baseSubtotal)) : 0;

        const descuentoGlobalAsignado = isLast
          ? round2(Math.max(appliedGlobalDiscount - allocatedDiscount, 0))
          : round2(Math.min(proportionalDiscount, precio));

        allocatedDiscount = round2(allocatedDiscount + descuentoGlobalAsignado);

        const subtotalSinImpuesto = round2(
          Math.max(precio - descuentoGlobalAsignado, 0)
        );
        const valorIva = round2(subtotalSinImpuesto * (porcentajeIva / 100));
        const totalLinea = round2(subtotalSinImpuesto + valorIva);

        return {
          ...test,
          pickerLabel: getOrderPickerTestLabel(test),
          subtotalOriginal: precio,
          descuentoItem: 0,
          descuentoGlobalAsignado,
          descuentoTotal: descuentoGlobalAsignado,
          subtotal: subtotalSinImpuesto,
          valorIva,
          totalLinea,
        };
      })
      .filter(Boolean) as any[];
  }, [selectedTests, tests, globalDiscount, globalDiscountType]);

  const selectedTestsSummaryGrouped = useMemo(() => {
    const mapa = new Map<string, any>();

    for (const test of selectedTestsSummary) {
      const nombre = String(test?.name || 'Prueba').trim();
      const key = nombre.toLowerCase();

      if (!mapa.has(key)) {
        mapa.set(key, {
          id: key,
          name: nombre,
          cantidad: 0,
          subtotalOriginal: 0,
          descuentoTotal: 0,
          subtotal: 0,
          valorIva: 0,
          totalLinea: 0,
        });
      }

      const item = mapa.get(key);

      item.cantidad += 1;
      item.subtotalOriginal += safeNumber(test.subtotalOriginal, 0);
      item.descuentoTotal += safeNumber(test.descuentoTotal, 0);
      item.subtotal += safeNumber(test.subtotal, 0);
      item.valorIva += safeNumber(test.valorIva, 0);
      item.totalLinea += safeNumber(test.totalLinea, 0);
    }

    return Array.from(mapa.values()).map((item) => ({
      ...item,
      subtotalOriginal: round2(item.subtotalOriginal),
      descuentoTotal: round2(item.descuentoTotal),
      subtotal: round2(item.subtotal),
      valorIva: round2(item.valorIva),
      totalLinea: round2(item.totalLinea),
    }));
  }, [selectedTestsSummary]);

  const resumenTotales = useMemo(() => {
    const subtotalOriginal = round2(
      selectedTestsSummary.reduce((acc, t) => acc + safeNumber(t.subtotalOriginal, 0), 0)
    );

    const descuento = round2(
      selectedTestsSummary.reduce((acc, t) => acc + safeNumber(t.descuentoTotal, 0), 0)
    );

    const subtotal = round2(
      selectedTestsSummary.reduce((acc, t) => acc + safeNumber(t.subtotal, 0), 0)
    );

    const iva = round2(
      selectedTestsSummary.reduce((acc, t) => acc + safeNumber(t.valorIva, 0), 0)
    );

    const total = round2(subtotal + iva);

    return { subtotalOriginal, descuento, subtotal, iva, total };
  }, [selectedTestsSummary]);

  const getParametrosPruebaOrdenados = (test: any) => {
    return [...(test?.parametros_prueba || [])].sort(
      (a: any, b: any) => safeNumber(a?.sort_order, 0) - safeNumber(b?.sort_order, 0)
    );
  };

    const agruparDetallesPorNombre = (detalles: any[]) => {
    const mapa = new Map<string, any>();

    for (const detalle of detalles || []) {
      const nombre = String(detalle?.pruebas?.name || 'Prueba').trim();
      const key = nombre.toLowerCase();

      if (!mapa.has(key)) {
        mapa.set(key, {
          nombre,
          cantidad: 0,
          subtotal: 0,
          iva: 0,
          total: 0,
        });
      }

      const item = mapa.get(key);

      item.cantidad += 1;
      item.subtotal += safeNumber(
        detalle?.subtotal_sin_impuesto,
        safeNumber(detalle?.price, 0)
      );
      item.iva += safeNumber(detalle?.valor_iva, 0);
      item.total += safeNumber(
        detalle?.total_linea,
        safeNumber(detalle?.price, 0) + safeNumber(detalle?.valor_iva, 0)
      );
    }

    return Array.from(mapa.values()).map((item) => ({
      ...item,
      subtotal: round2(item.subtotal),
      iva: round2(item.iva),
      total: round2(item.total),
    }));
  };

  const handleClearPatient = () => {
    setSelectedPatient('');
    setPatientSearch('');
    if (billingMode === 'PACIENTE') {
      setBillingForm({
        tipo_identificacion: 'CEDULA',
        identificacion: '',
        nombres: '',
        direccion: '',
        telefono: '',
        email: '',
      });
      setBillingCustomerId(null);
      setBillingFoundMessage('');
    }
  };

  const openCreatePatient = () => {
    setPatientForm({
      name: '',
      cedula: '',
      phone: '',
      email: '',
      birth_date: '',
      sex: 'M',
      direccion: '',
    });
    setPatientDialogOpen(true);
  };

  const openCreateDoctor = () => {
    setDoctorForm(initialDoctorForm);
    setDoctorDialogOpen(true);
  };

  const resetBillingSection = () => {
    setBillingMode('PACIENTE');
    setBillingCustomerId(null);
    setBillingFoundMessage('');
    setBillingForm({
      tipo_identificacion: 'CEDULA',
      identificacion: '',
      nombres: '',
      direccion: '',
      telefono: '',
      email: '',
    });
  };

  const openCreateOrderDialog = () => {
    setOrderWizardStep(1);
    setSelectedTests([]);
    setSelectedPatient('');
    setSelectedDoctor('');
    setPatientSearch('');
    setTestSearch('');
    setGlobalDiscountType('VALUE');
    setGlobalDiscount('');
    setInitialPaymentForm({
      amount: '',
      payment_method: 'EFECTIVO',
      reference: '',
      notes: '',
    });
    resetBillingSection();
    setDialogOpen(true);
  };


  const goToOrderWizardStep = (step: OrderWizardStep) => {
    if (step >= 2 && !selectedPatient) {
      toast.error('Seleccione un paciente para continuar');
      return;
    }

    if (step >= 3 && selectedTests.length === 0) {
      toast.error('Seleccione al menos una prueba para continuar');
      return;
    }

    setOrderWizardStep(step);
  };

  const handleSavePatient = async () => {
    if (!patientForm.name.trim() || !patientForm.cedula.trim() || !patientForm.birth_date) {
      toast.error('Nombre, cédula y fecha de nacimiento son obligatorios');
      return;
    }

    try {
      setCreatingPatient(true);

      const payload = {
        name: patientForm.name.trim(),
        cedula: patientForm.cedula.trim(),
        phone: patientForm.phone.trim() || null,
        email: patientForm.email.trim() || null,
        birth_date: patientForm.birth_date,
        sex: patientForm.sex,
        direccion: patientForm.direccion.trim() || null,
      };

      const { data, error } = await supabase
        .from('pacientes')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      toast.success('Paciente registrado');

      await fetchInitialData();

      if (data?.id) {
        setSelectedPatient(data.id);
        setPatientSearch('');
      }

      setPatientDialogOpen(false);
    } catch (error: any) {
      toast.error(
        'Error: ' +
          (error.message?.includes('unique') || error.message?.includes('pacientes_cedula_key')
            ? 'La cédula ya existe'
            : error.message)
      );
    } finally {
      setCreatingPatient(false);
    }
  };

  const handleSaveDoctor = async () => {
    if (!doctorForm.nombre.trim()) {
      toast.error('El nombre del médico es obligatorio');
      return;
    }

    try {
      setSavingDoctor(true);

      const payload = {
        nombre: doctorForm.nombre.trim(),
        especialidad: doctorForm.especialidad.trim() || null,
        telefono: doctorForm.telefono.trim() || null,
        email: doctorForm.email.trim() || null,
        activo: doctorForm.activo,
      };

      const { data, error } = await supabase
        .from('doctores')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      toast.success('Médico registrado');

      await fetchDoctors();

      if (data?.id) {
        setSelectedDoctor(data.id);
        setDoctorToAssign(data.id);
      }

      setDoctorDialogOpen(false);
      setDoctorForm(initialDoctorForm);
    } catch (error: any) {
      toast.error('Error al guardar médico: ' + error.message);
    } finally {
      setSavingDoctor(false);
    }
  };

  const buscarClienteFacturacion = async (
    identificacion: string,
    tipoIdentificacion: BillingIdType
  ) => {
    const id = identificacion.trim();

    if (!id || tipoIdentificacion === 'CONSUMIDOR_FINAL') return;

    try {
      setBillingLookupLoading(true);
      setBillingFoundMessage('');

      const { data, error } = await supabase
        .from('clientes_facturacion')
        .select('*')
        .eq('tipo_identificacion', tipoIdentificacion)
        .eq('identificacion', id)
        .limit(1);

      if (error) throw error;

      const cliente = data?.[0];

      if (cliente) {
        setBillingCustomerId(cliente.id);
        setBillingForm({
          tipo_identificacion: normalizeBillingIdType(cliente.tipo_identificacion),
          identificacion: cliente.identificacion || '',
          nombres: cliente.nombres || '',
          direccion: cliente.direccion || '',
          telefono: cliente.telefono || '',
          email: cliente.email || '',
        });
        setBillingFoundMessage('Cliente de facturación encontrado.');
      } else {
        setBillingCustomerId(null);
        setBillingFoundMessage('No existe registrado. Ingrese los datos manualmente.');
      }
    } catch (error: any) {
      toast.error('Error al buscar cliente de facturación: ' + error.message);
    } finally {
      setBillingLookupLoading(false);
    }
  };

  const upsertBillingCustomer = async (billingData: BillingFormType) => {
    const payload = {
      tipo_identificacion: billingData.tipo_identificacion,
      identificacion: billingData.identificacion.trim(),
      nombres: billingData.nombres.trim(),
      direccion: billingData.direccion.trim(),
      telefono: billingData.telefono.trim(),
      email: billingData.email.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (billingCustomerId) {
      const { data, error } = await supabase
        .from('clientes_facturacion')
        .update(payload)
        .eq('id', billingCustomerId)
        .select()
        .single();

      if (error) throw error;
      return data;
    }

    const { data: existingRows, error: existingError } = await supabase
      .from('clientes_facturacion')
      .select('*')
      .eq('tipo_identificacion', payload.tipo_identificacion)
      .eq('identificacion', payload.identificacion)
      .limit(1);

    if (existingError) throw existingError;

    const existing = existingRows?.[0];

    if (existing) {
      const { data, error } = await supabase
        .from('clientes_facturacion')
        .update(payload)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    }

    const { data, error } = await supabase
      .from('clientes_facturacion')
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  const validarFacturacion = (): { ok: boolean; data?: BillingFormType; message?: string } => {
    if (billingMode === 'PACIENTE') {
      if (!selectedPatientData) {
        return { ok: false, message: 'Debe seleccionar un paciente' };
      }

      const data: BillingFormType = {
        tipo_identificacion: 'CEDULA',
        identificacion: String(selectedPatientData.cedula || '').trim(),
        nombres: String(selectedPatientData.name || '').trim(),
        direccion: String(selectedPatientData.direccion || '').trim(),
        telefono: String(selectedPatientData.phone || '').trim(),
        email: String(selectedPatientData.email || '').trim(),
      };

      if (!data.identificacion) {
        return { ok: false, message: 'El paciente no tiene cédula registrada' };
      }
      if (!data.nombres) {
        return { ok: false, message: 'El paciente no tiene nombre válido' };
      }
      if (!data.direccion) {
        return { ok: false, message: 'El paciente no tiene dirección registrada' };
      }
      if (!data.telefono) {
        return { ok: false, message: 'El paciente no tiene teléfono registrado' };
      }

      return { ok: true, data };
    }

    if (billingMode === 'CONSUMIDOR_FINAL') {
      return { ok: true, data: CONSUMIDOR_FINAL_DATA };
    }

    const data: BillingFormType = {
      tipo_identificacion: billingForm.tipo_identificacion,
      identificacion: billingForm.identificacion.trim(),
      nombres: billingForm.nombres.trim(),
      direccion: billingForm.direccion.trim(),
      telefono: billingForm.telefono.trim(),
      email: billingForm.email.trim(),
    };

    if (!data.tipo_identificacion) {
      return { ok: false, message: 'Debe seleccionar el tipo de identificación' };
    }
    if (!data.identificacion) {
      return { ok: false, message: 'Debe ingresar la identificación del cliente' };
    }
    if (!data.nombres) {
      return { ok: false, message: 'Debe ingresar los nombres del cliente' };
    }
    if (!data.direccion) {
      return { ok: false, message: 'Debe ingresar la dirección del cliente' };
    }
    if (!data.telefono) {
      return { ok: false, message: 'Debe ingresar el teléfono del cliente' };
    }

    return { ok: true, data };
  };

  const enviarFacturaPorCorreo = async (params: {
    to: string;
    numeroFactura: string;
    clienteNombre?: string;
    pdfPath: string;
  }) => {
    const cleanPath = String(params.pdfPath || '').trim().replace(/^\/+/, '');

    if (!cleanPath) {
      throw new Error('No existe PDF de factura para enviar');
    }

    const { data: publicData } = supabase.storage
      .from('facturas-pdf')
      .getPublicUrl(cleanPath);

    const pdfUrl = publicData?.publicUrl;

    if (!pdfUrl) {
      throw new Error('No se pudo obtener la URL pública del PDF de factura');
    }

    await sendDocumentEmail({
      to: params.to,
      documentType: 'factura',
      orderCode: params.numeroFactura,
      patientName: params.clienteNombre || '',
      pdfUrl,
      filename: `factura_${params.numeroFactura}.pdf`,
    });
  };

  const openRidePdf = async (pdfPath: string) => {
    if (!pdfPath) {
      toast.error('No existe PDF RIDE para esta orden');
      return;
    }

    const cleanPath = pdfPath.trim().replace(/^\/+/, '');

    const { data } = supabase.storage.from('facturas-pdf').getPublicUrl(cleanPath);

    if (!data?.publicUrl) {
      toast.error('No se pudo obtener la URL pública del PDF RIDE');
      return;
    }

    window.open(data.publicUrl, '_blank', 'noopener,noreferrer');
  };

  const generarRideDesdeXml = async (
    orderId: string,
    silent = false,
    abrirDespues = true
  ) => {
    try {
      setGeneratingRide(orderId);

      const { data, error } = await supabase.functions.invoke('generar-ride-desde-xml', {
        body: { order_id: orderId },
      });

      if (error) {
        if (!silent) {
          toast.error('No se pudo generar el PDF RIDE desde el XML');
        }
        return false;
      }

      if (!data?.ok) {
        if (!silent) {
          toast.error(data?.message || 'No se pudo generar el PDF RIDE');
        }
        return false;
      }

      await fetchInitialData();

      const { data: updatedOrder, error: updatedOrderError } = await supabase
        .from('ordenes')
        .select(`
          *,
          pacientes(name, cedula, email),
          doctores(nombre, especialidad),
          orden_pagos(*)
        `)
        .eq('id', orderId)
        .single();

      if (!updatedOrderError && updatedOrder) {
        if (selectedOrder?.id === orderId) {
          setSelectedOrder(updatedOrder);
        }

        if (paymentOrder?.id === orderId) {
          setPaymentOrder(updatedOrder);
        }

        if (abrirDespues && updatedOrder.factura_ride_pdf_path) {
          await openRidePdf(updatedOrder.factura_ride_pdf_path);
        }
      }

      if (!silent) {
        toast.success(data?.message || 'PDF RIDE generado correctamente');
      }

      return true;
    } catch (error: any) {
      if (!silent) {
        toast.error('Error al generar RIDE: ' + error.message);
      }
      return false;
    } finally {
      setGeneratingRide(null);
    }
  };

  const generarFacturaElectronica = async (orderId: string) => {
    const { data: facturaResp, error: facturaError } = await supabase.functions.invoke(
      'generar-factura-electronica',
      {
        body: { order_id: orderId },
      }
    );

    if (facturaError) {
      throw new Error('Falló la comunicación con la facturación electrónica');
    }

    if (!facturaResp?.ok) {
      const sriDetalle = facturaResp?.sri_mensajes
        ?.map((m: any) =>
          [m.identificador, m.mensaje, m.informacionAdicional]
            .filter(Boolean)
            .join(' - ')
        )
        .join(' | ');

      throw new Error(
        sriDetalle ||
          facturaResp?.message ||
          'No se pudo generar la factura electrónica'
      );
    }

    return facturaResp;
  };

  const handleCreate = async () => {
    if (!selectedPatient || selectedTests.length === 0) return;

    const paciente = patients.find((p) => p.id === selectedPatient);
    if (!paciente) {
      toast.error('Debe seleccionar un paciente válido');
      return;
    }

    const validacionFact = validarFacturacion();
    if (!validacionFact.ok || !validacionFact.data) {
      toast.error(validacionFact.message || 'Datos de facturación incompletos');
      return;
    }

    const initialAmount = round2(Number(initialPaymentForm.amount || 0));
    const totalOrden = resumenTotales.total;

    if (initialPaymentForm.amount && (!Number.isFinite(initialAmount) || initialAmount < 0)) {
      toast.error('El monto del pago inicial no es válido');
      return;
    }

    if (initialAmount > totalOrden) {
      toast.error('El pago inicial no puede ser mayor al total de la orden');
      return;
    }

    setCreating(true);

    const total = totalOrden;
    const orderCode = generateOrderCode();
    const accessKey = generateAccessKey();

    try {
      const billingCustomer = await upsertBillingCustomer(validacionFact.data);

      const billingDataToUse = {
        tipo_identificacion:
          billingCustomer?.tipo_identificacion ||
          validacionFact.data.tipo_identificacion,
        identificacion: String(
          billingCustomer?.identificacion || validacionFact.data.identificacion || ''
        ).trim(),
        nombres: String(
          billingCustomer?.nombres || validacionFact.data.nombres || ''
        ).trim(),
        direccion: String(
          billingCustomer?.direccion || validacionFact.data.direccion || ''
        ).trim(),
        telefono: String(
          billingCustomer?.telefono || validacionFact.data.telefono || ''
        ).trim(),
        email: String(
          billingCustomer?.email || validacionFact.data.email || ''
        ).trim(),
      };

      const { data: order, error: orderError } = await supabase
        .from('ordenes')
        .insert([
          {
            code: orderCode,
            access_key: accessKey,
            patient_id: selectedPatient,
            doctor_id: selectedDoctor || null,
            total,
            status: 'pending',
            factura_estado: 'PENDIENTE',
            billing_customer_id: billingCustomer?.id || null,
            factura_tipo_identificacion: billingDataToUse.tipo_identificacion,
            factura_identificacion: billingDataToUse.identificacion,
            factura_nombres: billingDataToUse.nombres,
            factura_direccion: billingDataToUse.direccion,
            factura_telefono: billingDataToUse.telefono,
            factura_email: billingDataToUse.email || null,
          },
        ])
        .select()
        .single();

      if (orderError) throw orderError;

      for (const summary of selectedTestsSummary) {
        const porcentajeIva = round2(safeNumber(summary.porcentaje_iva, 0));
        const codigoPorcentajeIva = String(
          summary.codigo_porcentaje_iva || obtenerCodigoPorcentajeIva(porcentajeIva)
        );
        const objetoImpuesto = String(summary.objeto_impuesto || '2');

        const { error: detailError } = await supabase.from('orden_detalle').insert({
          order_id: order.id,
          test_id: summary.id,
          price: round2(safeNumber(summary.subtotalOriginal, 0)),
          descuento: round2(safeNumber(summary.descuentoTotal, 0)),
          porcentaje_iva: porcentajeIva,
          codigo_porcentaje_iva: codigoPorcentajeIva,
          objeto_impuesto: objetoImpuesto,
          subtotal_sin_impuesto: round2(safeNumber(summary.subtotal, 0)),
          valor_iva: round2(safeNumber(summary.valorIva, 0)),
          total_linea: round2(safeNumber(summary.totalLinea, 0)),
        });

        if (detailError) throw detailError;

        if (summary.prueba_reactivos) {
          for (const tr of summary.prueba_reactivos) {
            const { error: stockError } = await supabase.rpc('decrement_reagent_stock', {
              row_id: tr.reagent_id,
              amount: tr.quantity_used,
            });

            if (stockError) throw stockError;
          }
        }
      }

      if (initialAmount > 0) {
        const { error: paymentError } = await supabase.from('orden_pagos').insert([
          {
            order_id: order.id,
            amount: initialAmount,
            payment_method: initialPaymentForm.payment_method,
            reference: initialPaymentForm.reference.trim() || null,
            notes: initialPaymentForm.notes.trim() || null,
          },
        ]);

        if (paymentError) throw paymentError;
      }

      let facturaResp: any = null;
      const saldoDespuesPago = round2(Math.max(total - initialAmount, 0));
      const pagoCompletoInicial = initialAmount > 0 && saldoDespuesPago <= 0;

      if (pagoCompletoInicial) {
        try {
          facturaResp = await generarFacturaElectronica(order.id);
        } catch (facturaError: any) {
          toast.warning(
            'La orden y el pago fueron registrados, pero no se pudo generar la factura electrónica: ' +
              (facturaError?.message || 'desconocido')
          );
        }
      }

      if (pagoCompletoInicial && facturaResp) {
        const facturaAutorizada =
          facturaResp?.sri_estado === 'AUTORIZADO' ||
          facturaResp?.factura_estado === 'AUTORIZADO' ||
          facturaResp?.autorizado === true;

        const esConsumidorFinal =
          billingDataToUse.tipo_identificacion === 'CONSUMIDOR_FINAL' ||
          billingDataToUse.identificacion === '9999999999999';

        if (facturaResp?.sri_estado === 'EN_PROCESAMIENTO') {
          toast.info(
            facturaResp?.message ||
              'Orden creada, pago completo registrado y factura enviada al SRI en procesamiento.'
          );
        } else if (facturaAutorizada) {
          if (
            !esConsumidorFinal &&
            billingDataToUse.email &&
            facturaResp?.factura_ride_pdf_path &&
            facturaResp?.numero_factura
          ) {
            try {
              await enviarFacturaPorCorreo({
                to: billingDataToUse.email,
                numeroFactura: facturaResp.numero_factura,
                clienteNombre: billingDataToUse.nombres,
                pdfPath: facturaResp.factura_ride_pdf_path,
              });

              toast.success(
                'Orden creada, pago completo registrado y factura enviada por correo.'
              );
            } catch (emailError: any) {
              toast.warning(
                'La factura fue autorizada, pero no se pudo enviar por correo: ' +
                  (emailError?.message || 'desconocido')
              );
            }
          } else {
            toast.success('Orden creada, pago completo registrado y factura generada.');
          }
        } else {
          toast.success('Orden creada y pago completo registrado.');
        }
      } else if (initialAmount > 0) {
        toast.success('Orden creada y pago inicial registrado correctamente.');
      } else {
        toast.success('Orden creada correctamente.');
      }

      setDialogOpen(false);
      setSelectedPatient('');
      setSelectedDoctor('');
      setSelectedTests([]);
      setPatientSearch('');
      setTestSearch('');
      setOrderWizardStep(1);
      setGlobalDiscountType('VALUE');
      setGlobalDiscount('');
      resetBillingSection();
      setInitialPaymentForm({
        amount: '',
        payment_method: 'EFECTIVO',
        reference: '',
        notes: '',
      });

      await fetchInitialData();
      
      printThermalTicket(order.id);
      
    } catch (error: any) {
      toast.error('Error al crear orden: ' + error.message);
    } finally {
      setCreating(false);
    }
  };

  const recheckSriStatus = async (orderId: string) => {
    try {
      setCheckingSri(orderId);

      const { data, error } = await supabase.functions.invoke(
        'consultar-factura-electronica',
        {
          body: { order_id: orderId },
        }
      );

      if (error) {
        toast.error('No se pudo reconsultar el estado en SRI');
        return;
      }

      if (data?.ok) {
        toast.success(data?.message || 'Factura autorizada correctamente');

        if (
          data?.sri_estado === 'AUTORIZADO' ||
          data?.factura_estado === 'AUTORIZADO' ||
          data?.autorizado === true
        ) {
          await generarRideDesdeXml(orderId, true, false);
        }
      } else if (data?.sri_estado === 'EN_PROCESAMIENTO') {
        toast.info(data?.message || 'La factura aún sigue en procesamiento en el SRI');
      } else {
        const sriDetalle = data?.sri_mensajes
          ?.map((m: any) =>
            [m.identificador, m.mensaje, m.informacionAdicional]
              .filter(Boolean)
              .join(' - ')
          )
          .join(' | ');

        toast.error(
          sriDetalle || data?.message || 'La factura aún no ha sido autorizada'
        );
      }

      await fetchInitialData();

      if (selectedOrder?.id === orderId) {
        const { data: updatedOrder } = await supabase
          .from('ordenes')
          .select(`
            *,
            pacientes(name, cedula, email),
            doctores(nombre, especialidad),
            orden_pagos(*)
          `)
          .eq('id', orderId)
          .single();

        if (updatedOrder) {
          setSelectedOrder(updatedOrder);
        }
      }
    } catch (error: any) {
      toast.error('Error al reconsultar SRI: ' + error.message);
    } finally {
      setCheckingSri(null);
    }
  };

  const openInvoiceDialog = async (orderId: string) => {
    const { data: order, error } = await supabase
      .from('ordenes')
      .select(`
        *,
        pacientes(name, cedula, email),
        doctores(nombre, especialidad),
        orden_pagos(*),
        orden_detalle(
          test_id,
          price,
          subtotal_sin_impuesto,
          valor_iva,
          total_linea,
          porcentaje_iva,
          pruebas(name, price)
        )
      `)
      .eq('id', orderId)
      .single();

    if (error || !order) {
      toast.error('No se pudo cargar la factura de la orden');
      return;
    }

    setSelectedOrder(order);
    setInvoiceDialogOpen(true);
  };

  const openPaymentDialog = async (orderId: string) => {
    const { data: order, error } = await supabase
      .from('ordenes')
      .select(`
        *,
        pacientes(name, cedula, email),
        doctores(nombre, especialidad),
        orden_pagos(*)
      `)
      .eq('id', orderId)
      .single();

    if (error || !order) {
      toast.error('No se pudo cargar la orden');
      return;
    }

    setPaymentOrder(order);
    setPaymentForm({
      amount: '',
      payment_method: 'EFECTIVO',
      reference: '',
      notes: '',
    });
    setPaymentDialogOpen(true);
  };

  const generarFacturaElectronicaAlPagar = async (orderId: string) => {
    const { data: facturaResp, error: facturaError } = await supabase.functions.invoke(
      'generar-factura-electronica',
      {
        body: { order_id: orderId },
      }
    );

    if (facturaError) {
      throw new Error('Falló la comunicación con la facturación electrónica');
    }

    if (!facturaResp?.ok) {
      const sriDetalle = facturaResp?.sri_mensajes
        ?.map((m: any) =>
          [m.identificador, m.mensaje, m.informacionAdicional]
            .filter(Boolean)
            .join(' - ')
        )
        .join(' | ');

      throw new Error(
        sriDetalle ||
          facturaResp?.message ||
          'No se pudo generar la factura electrónica'
      );
    }

    return facturaResp;
  };

  const handleSavePayment = async () => {
    if (!paymentOrder) return;

    const amount = round2(Number(paymentForm.amount));
    const total = safeNumber(paymentOrder.total, 0);
    const paidAmount = safeNumber(paymentOrder.paid_amount, 0);
    const saldo = round2(Math.max(total - paidAmount, 0));
    const saldoDespuesPago = round2(Math.max(saldo - amount, 0));
    const completaPago = saldo > 0 && saldoDespuesPago <= 0;

    if (!amount || amount <= 0) {
      toast.error('Ingrese un monto válido');
      return;
    }

    if (amount > saldo) {
      toast.error('El monto no puede ser mayor al saldo pendiente');
      return;
    }

    try {
      setSavingPayment(true);

      const { error } = await supabase.from('orden_pagos').insert([
        {
          order_id: paymentOrder.id,
          amount,
          payment_method: paymentForm.payment_method,
          reference: paymentForm.reference.trim() || null,
          notes: paymentForm.notes.trim() || null,
        },
      ]);

      if (error) throw error;

      setPaymentDialogOpen(false);

      let facturaResp: any = null;

      if (completaPago) {
        try {
          facturaResp = await generarFacturaElectronicaAlPagar(paymentOrder.id);
        } catch (facturaGenError: any) {
          await fetchInitialData();

          toast.warning(
            'Pago registrado correctamente, pero no se pudo generar la factura electrónica: ' +
              (facturaGenError?.message || 'desconocido')
          );
        }
      } else {
        toast.success('Pago registrado correctamente');
      }

      await fetchInitialData();

      const { data: updatedOrder } = await supabase
        .from('ordenes')
        .select(`
          *,
          pacientes(name, cedula, email),
          doctores(nombre, especialidad),
          orden_pagos(*)
        `)
        .eq('id', paymentOrder.id)
        .single();

      if (updatedOrder) {
        setPaymentOrder(updatedOrder);

        if (selectedOrder?.id === updatedOrder.id) {
          setSelectedOrder(updatedOrder);
        }

        const saldoAnterior = saldo;
        const totalNuevo = Number(updatedOrder.total || 0);
        const pagadoNuevo = Number(updatedOrder.paid_amount || 0);
        const saldoNuevo = Math.max(totalNuevo - pagadoNuevo, 0);

        if (completaPago) {
          const facturaAutorizada =
            facturaResp?.sri_estado === 'AUTORIZADO' ||
            facturaResp?.factura_estado === 'AUTORIZADO' ||
            facturaResp?.autorizado === true;

          const esConsumidorFinal =
            updatedOrder.factura_tipo_identificacion === 'CONSUMIDOR_FINAL' ||
            updatedOrder.factura_identificacion === '9999999999999';

          if (facturaResp?.sri_estado === 'EN_PROCESAMIENTO') {
            toast.info(
              facturaResp?.message ||
                'Pago completado. La factura fue enviada al SRI y sigue en procesamiento.'
            );
          } else if (facturaAutorizada) {
            if (
              !esConsumidorFinal &&
              updatedOrder.factura_email &&
              facturaResp?.factura_ride_pdf_path &&
              facturaResp?.numero_factura
            ) {
              try {
                await enviarFacturaPorCorreo({
                  to: updatedOrder.factura_email,
                  numeroFactura: facturaResp.numero_factura,
                  clienteNombre: updatedOrder.factura_nombres,
                  pdfPath: facturaResp.factura_ride_pdf_path,
                });

                toast.success(
                  'Pago completado, factura generada correctamente y enviada por correo.'
                );
              } catch (emailError: any) {
                toast.warning(
                  'La factura fue autorizada, pero no se pudo enviar por correo: ' +
                    (emailError?.message || 'desconocido')
                );
              }
            } else {
              toast.success('Pago completado y factura generada correctamente.');
            }
          } else if (saldoAnterior > 0 && saldoNuevo <= 0) {
            toast.success('Pago completado correctamente.');
          }
        }

        if (
          updatedOrder.status === 'completed' &&
          saldoAnterior > 0 &&
          saldoNuevo <= 0 &&
          updatedOrder.pacientes?.email
        ) {
          try {
            const { data: resultRows, error: resultError } = await supabase
              .from('resultados')
              .select('resultados_url')
              .eq('order_id', updatedOrder.id)
              .not('resultados_url', 'is', null)
              .limit(1);

            if (resultError) throw resultError;

            const pdfUrl = resultRows?.[0]?.resultados_url;

            if (pdfUrl) {
              await sendDocumentEmail({
                to: updatedOrder.pacientes.email,
                documentType: 'resultados',
                orderCode: updatedOrder.code,
                patientName: updatedOrder.pacientes?.name || '',
                pdfUrl,
                filename: `resultados_${updatedOrder.code}.pdf`,
              });

              toast.success('Resultados enviados al paciente');
            }
          } catch (emailError: any) {
            toast.error(
              'El pago se registró, pero no se pudieron enviar los resultados: ' +
                (emailError?.message || 'desconocido')
            );
          }
        }
      }
    } catch (error: any) {
      toast.error('Error al registrar pago: ' + error.message);
    } finally {
      setSavingPayment(false);
    }
  };

  const openXmlFile = async (xmlPath: string) => {
    if (!xmlPath) {
      toast.error('No existe XML para esta orden');
      return;
    }

    const cleanPath = xmlPath.trim().replace(/^\/+/, '');

    const { data } = supabase.storage.from('facturas-xml').getPublicUrl(cleanPath);

    if (!data?.publicUrl) {
      toast.error('No se pudo obtener la URL pública del XML');
      return;
    }

    window.open(data.publicUrl, '_blank', 'noopener,noreferrer');
  };

  const printThermalTicket = async (orderId: string) => {
    const { data: order } = await supabase
      .from('ordenes')
      .select(`
        *,
        pacientes(*),
        doctores(nombre, especialidad),
        orden_detalle(
          test_id,
          price,
          porcentaje_iva,
          valor_iva,
          total_linea,
          pruebas(
            name,
            price,
            description,
            visible_description,
            parametros_prueba(
              id,
              name
            )
          )
        )
      `)
      .eq('id', orderId)
      .single();

    if (!order) return;

    const subtotal = round2(
      (order.orden_detalle || []).reduce((acc: number, d: any) => acc + safeNumber(d.price), 0)
    );

    const iva = round2(
      (order.orden_detalle || []).reduce((acc: number, d: any) => acc + safeNumber(d.valor_iva), 0)
    );

    const total = round2(
      (order.orden_detalle || []).reduce(
        (acc: number, d: any) => acc + safeNumber(d.total_linea, d.price),
        0
      )
    );

    const pagado = round2(safeNumber(order.paid_amount, 0));
    const saldo = round2(Math.max(total - pagado, 0));

    const detallesAgrupadosTicket = groupOrderDetailsForTicket(order.orden_detalle || []);
    const portalUrl = `${window.location.origin}/portal?clave=${order.access_key}`;

    const qrDataUrl = await QRCode.toDataURL(portalUrl, {
      width: 180,
      margin: 1,
    });

    const logoHtml = labConfig?.logo
      ? `
        <div class="logo-wrap">
          <img src="${labConfig.logo}" class="logo" alt="Logo laboratorio" />
        </div>
      `
      : '';

    const labName = labConfig?.name || 'LABORATORIO CLÍNICO';
    const labOwner = labConfig?.owner || '';
    const labAddress = labConfig?.address || '';
    const labPhone = labConfig?.phone || '';
    const labSchedule = labConfig?.schedule || '';
    const labRuc = labConfig?.ruc || '';
    const labReg = labConfig?.health_registry || '';

    const doctorHtml = order.doctores?.nombre
      ? `<div><b>MÉDICO:</b> ${order.doctores.nombre}</div>`
      : '';

    const facturacionHtml = `
      <div class="line"></div>
      <div class="bold">DATOS FACTURA</div>
      <div><b>NOMBRE:</b> ${order.factura_nombres || '—'}</div>
      <div><b>ID:</b> ${order.factura_identificacion || '—'}</div>
      <div><b>TIPO:</b> ${order.factura_tipo_identificacion || '—'}</div>
    `;

    const printWindow = window.open('', '_blank', 'width=320,height=950');
    if (!printWindow) return;

    const ticketHTML = `
      <html>
        <head>
          <title>Ticket de recepción</title>
          <style>
            @page { size: 58mm auto; margin: 0; }
            * { box-sizing: border-box; }
            body {
              font-family: Arial, Helvetica, sans-serif;
              width: 58mm;
              padding: 6px;
              margin: 0;
              font-size: 11px;
              line-height: 1.25;
              color: #000;
            }
            .center { text-align: center; }
            .bold { font-weight: 700; }
            .line { border-bottom: 1px dashed #000; margin: 6px 0; }
            .flex { display: flex; justify-content: space-between; gap: 8px; }
            .small { font-size: 9px; word-break: break-word; }
            .tiny { font-size: 8px; word-break: break-word; }
            .qr { display: flex; justify-content: center; margin-top: 8px; }
            .qr img { width: 110px; height: 110px; }
            .logo-wrap {
              display: flex;
              justify-content: center;
              margin-bottom: 4px;
            }
            .logo {
              max-width: 90px;
              max-height: 90px;
              object-fit: contain;
            }
            .access-box {
              border: 1px solid #000;
              padding: 4px;
              font-size: 15px;
              font-weight: 700;
              text-align: center;
              letter-spacing: 1px;
              margin-top: 4px;
            }
            .test-row {
              display: flex;
              justify-content: space-between;
              gap: 6px;
              margin-bottom: 2px;
            }
            .test-name {
              flex: 1;
              word-break: break-word;
            }
            .test-price {
              white-space: nowrap;
            }
          </style>
        </head>

        <body>
          ${logoHtml}

          <div class="center bold">${labName}</div>
          ${labOwner ? `<div class="center small">${labOwner}</div>` : ''}
          ${labAddress ? `<div class="center tiny">${labAddress}</div>` : ''}
          ${labPhone ? `<div class="center small">Tel: ${labPhone}</div>` : ''}
          ${labSchedule ? `<div class="center tiny">${labSchedule}</div>` : ''}
          ${labRuc ? `<div class="center small">RUC: ${labRuc}</div>` : ''}
          ${labReg ? `<div class="center small">Reg: ${labReg}</div>` : ''}

          <div class="line"></div>

          <div class="center bold">COMPROBANTE DE RECEPCIÓN</div>

          <div class="line"></div>

          <div><b>ORDEN:</b> ${order.code}</div>
          <div><b>FECHA:</b> ${new Date(order.created_at).toLocaleDateString()}</div>
          <div><b>PACIENTE:</b> ${order.pacientes?.name || ''}</div>
          <div><b>ID PACIENTE:</b> ${order.pacientes?.cedula || ''}</div>
          ${doctorHtml}

          ${facturacionHtml}

          <div class="line"></div>

          <div class="center bold">CLAVE DE ACCESO WEB</div>
          <div class="access-box">${order.access_key}</div>

          ${order.numero_factura ? `
            <div class="line"></div>
            <div><b>FACTURA:</b> ${order.numero_factura}</div>
            <div><b>ESTADO FE:</b> ${order.factura_estado}</div>
          ` : ''}

          ${order.clave_acceso_sri ? `
            <div class="small"><b>CLAVE SRI:</b> ${order.clave_acceso_sri}</div>
          ` : ''}

          ${order.numero_autorizacion_sri ? `
            <div class="small"><b>AUTORIZACIÓN:</b> ${order.numero_autorizacion_sri}</div>
          ` : ''}

          <div class="line"></div>

          <div class="bold">PRUEBAS:</div>

            ${detallesAgrupadosTicket
              .map((grupo: any) => {
                const isGrouped = grupo.items.length > 1;

                return grupo.items
                  .map((detalle: any) => {
                    const prueba = detalle?.pruebas || {};
                    const variantLabel = buildVariantLabelFromTest(prueba, isGrouped);
                    const testName = String(prueba?.name || 'Prueba').trim();

                    const labelToShow = variantLabel.trim() || testName;

                    return `
                      <div class="test-row">
                        <span class="test-name">- ${labelToShow}</span>
                        <span class="test-price">$${Number(detalle.price || 0).toFixed(2)}</span>
                      </div>
                    `;
                  })
                  .join('');
              })
              .join('')}

          <div class="line"></div>

          <div class="flex">
            <span>SUBTOTAL:</span>
            <span>$${subtotal.toFixed(2)}</span>
          </div>

          <div class="flex">
            <span>IVA:</span>
            <span>$${iva.toFixed(2)}</span>
          </div>

          <div class="flex bold">
            <span>TOTAL:</span>
            <span>$${total.toFixed(2)}</span>
          </div>

          <div class="flex">
            <span>PAGADO:</span>
            <span>$${pagado.toFixed(2)}</span>
          </div>

          <div class="flex bold">
            <span>SALDO:</span>
            <span>$${saldo.toFixed(2)}</span>
          </div>

          <div class="line"></div>

          <div class="center">Consulte sus resultados en:</div>
          <div class="center bold tiny">${portalUrl}</div>

          <div class="qr">
            <img src="${qrDataUrl}" alt="QR portal resultados" />
          </div>

          <div class="center small">Escanee el código QR</div>
        </body>
      </html>
    `;

    printWindow.document.write(ticketHTML);
    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  const filtered = orders.filter((o) => {
    const q = search.toLowerCase();
    const total = safeNumber(o.total, 0);
    const pagado = safeNumber(o.paid_amount, 0);
    const saldo = round2(Math.max(total - pagado, 0));

    const noEstaPagada = o.payment_status !== 'PAGADO' && saldo > 0;

    const matchesSearch =
      o.code?.toLowerCase().includes(q) ||
      o.pacientes?.name?.toLowerCase().includes(q) ||
      o.doctores?.nombre?.toLowerCase().includes(q) ||
      o.numero_factura?.toLowerCase().includes(q) ||
      o.clave_acceso_sri?.toLowerCase().includes(q) ||
      o.factura_nombres?.toLowerCase().includes(q) ||
      o.factura_identificacion?.toLowerCase().includes(q);

    return noEstaPagada && matchesSearch;
  });

  const selectedOrderDetallesAgrupados = useMemo(() => {
    if (!selectedOrder?.orden_detalle) return [];
    return agruparDetallesPorNombre(selectedOrder.orden_detalle);
  }, [selectedOrder]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Órdenes de Laboratorio</h1>
          <p className="text-muted-foreground text-sm">
            Gestión de facturación, pagos y tickets térmicos
          </p>
        </div>

        <Button
          onClick={openCreateOrderDialog}
          className="gradient-clinical text-primary-foreground border-0"
        >
          <Plus className="w-4 h-4 mr-2" /> Nueva Orden
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-10"
          placeholder="Buscar por código, paciente, médico, factura o cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead className="hidden md:table-cell">Médico</TableHead>
                <TableHead className="hidden md:table-cell">Factura</TableHead>
                <TableHead>Total</TableHead>
                <TableHead className="hidden md:table-cell">Pagado</TableHead>
                <TableHead className="hidden md:table-cell">Saldo</TableHead>
                <TableHead>Estado Orden</TableHead>
                <TableHead>Estado Pago</TableHead>
                <TableHead>Estado Factura</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filtered.map((order) => {
                const total = safeNumber(order.total, 0);
                const pagado = safeNumber(order.paid_amount, 0);
                const saldo = round2(Math.max(total - pagado, 0));

                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-bold text-slate-700">{order.code}</TableCell>

                    <TableCell className="text-sm">{order.pacientes?.name}</TableCell>

                    <TableCell className="hidden md:table-cell text-sm">
                      {order.doctores?.nombre ? (
                        <div className="flex items-center gap-2">
                          <Stethoscope className="w-3.5 h-3.5 text-slate-400" />
                          <span>{order.doctores.nombre}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    <TableCell className="hidden md:table-cell">
                      {order.numero_factura ? (
                        <Badge variant="outline" className="font-mono">
                          {order.numero_factura}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Sin factura</Badge>
                      )}
                    </TableCell>

                    <TableCell className="font-bold text-primary">
                      ${total.toFixed(2)}
                    </TableCell>

                    <TableCell className="hidden md:table-cell">
                      ${pagado.toFixed(2)}
                    </TableCell>

                    <TableCell className="hidden md:table-cell font-medium">
                      ${saldo.toFixed(2)}
                    </TableCell>

                    <TableCell>
                      <Badge variant={order.status === 'completed' ? 'default' : 'secondary'}>
                        {order.status === 'pending'
                          ? 'Pendiente'
                          : order.status === 'in_progress'
                          ? 'En Proceso'
                          : 'Finalizado'}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant={
                          order.payment_status === 'PAGADO'
                            ? 'default'
                            : order.payment_status === 'ABONADO'
                            ? 'outline'
                            : order.payment_status === 'ANULADO'
                            ? 'destructive'
                            : 'secondary'
                        }
                      >
                        {order.payment_status || 'PENDIENTE'}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant={
                          order.factura_estado === 'AUTORIZADO'
                            ? 'default'
                            : order.factura_estado === 'GENERADA' ||
                              order.factura_estado === 'EN_PROCESAMIENTO'
                            ? 'outline'
                            : order.factura_estado === 'DEVUELTA' ||
                              order.factura_estado === 'NO AUTORIZADO'
                            ? 'destructive'
                            : 'secondary'
                        }
                      >
                        {order.factura_estado === 'EN_PROCESAMIENTO'
                          ? 'Procesando SRI'
                          : order.factura_estado || 'PENDIENTE'}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {order.factura_estado === 'EN_PROCESAMIENTO' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => recheckSriStatus(order.id)}
                            title="Reconsultar SRI"
                            disabled={checkingSri === order.id}
                          >
                            {checkingSri === order.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RefreshCw className="w-4 h-4" />
                            )}
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openAssignDoctorDialog(order.id)}
                          title={order.doctores?.nombre ? 'Editar médico' : 'Asignar médico'}
                        >
                          <Stethoscope className="w-4 h-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openPaymentDialog(order.id)}
                          title="Registrar pago"
                        >
                          <Wallet className="w-4 h-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => printThermalTicket(order.id)}
                          title="Reimprimir Ticket"
                        >
                          <Printer className="w-4 h-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openInvoiceDialog(order.id)}
                          title="Ver Factura"
                        >
                          <FileText className="w-4 h-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            openXmlFile(
                              order.factura_xml_autorizado_path ||
                                order.factura_xml_firmado_path ||
                                order.factura_xml_path
                            )
                          }
                          title="Abrir XML"
                          disabled={
                            !order.factura_xml_autorizado_path &&
                            !order.factura_xml_firmado_path &&
                            !order.factura_xml_path
                          }
                        >
                          <FileCode className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}

              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-10 text-muted-foreground">
                    No se encontraron órdenes
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setOrderWizardStep(1);
        }}
      >
        <DialogContent className="max-w-5xl w-[96vw] max-h-[94vh] overflow-hidden rounded-3xl p-0">
          <div className="flex max-h-[94vh] flex-col bg-slate-50">
            <DialogHeader className="shrink-0 border-b bg-white px-5 py-5 sm:px-7">
              <div className="space-y-4">
                <div>
                  <DialogTitle className="font-display text-2xl sm:text-3xl font-bold">
                    Generar nueva orden
                  </DialogTitle>
                  <p className="mt-1 text-sm text-slate-500">
                    Complete los datos en tres pasos.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { step: 1 as OrderWizardStep, title: 'Paciente y médico' },
                    { step: 2 as OrderWizardStep, title: 'Pruebas' },
                    { step: 3 as OrderWizardStep, title: 'Pago' },
                  ].map((item) => {
                    const active = orderWizardStep === item.step;
                    const completed = orderWizardStep > item.step;
                    const enabled =
                      item.step === 1 ||
                      (item.step === 2 && !!selectedPatient) ||
                      (item.step === 3 && !!selectedPatient && selectedTests.length > 0);

                    return (
                      <button
                        key={item.step}
                        type="button"
                        disabled={!enabled}
                        onClick={() => goToOrderWizardStep(item.step)}
                        className={`rounded-2xl border px-2 py-3 text-left transition sm:px-4 ${
                          active
                            ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                            : completed
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : 'border-slate-200 bg-white text-slate-500'
                        } disabled:cursor-not-allowed disabled:opacity-50`}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                              active
                                ? 'bg-white/20 text-white'
                                : completed
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {completed ? '✓' : item.step}
                          </div>
                          <span className="hidden text-xs font-semibold sm:block lg:text-sm">
                            {item.title}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
              {orderWizardStep === 1 && (
                <div className="mx-auto max-w-3xl space-y-7">
                  <section className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <Label className="text-xs font-bold uppercase tracking-wide text-slate-700">
                          Paciente *
                        </Label>
                        <p className="mt-1 text-xs text-slate-500">
                          Busque un paciente existente o registre uno nuevo.
                        </p>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        onClick={openCreatePatient}
                      >
                        <UserPlus className="mr-2 h-4 w-4" />
                        Nuevo paciente
                      </Button>
                    </div>

                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        className="h-12 rounded-xl border-slate-200 bg-white pl-10 pr-24 shadow-sm disabled:bg-slate-100"
                        placeholder="Buscar por nombre, cédula o email..."
                        value={
                          selectedPatientData
                            ? `${selectedPatientData.name} — ${
                                selectedPatientData.cedula || 'Sin cédula'
                              }`
                            : patientSearch
                        }
                        onChange={(e) => setPatientSearch(e.target.value)}
                        disabled={!!selectedPatientData}
                      />

                      {selectedPatientData && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg"
                          onClick={handleClearPatient}
                        >
                          Cambiar
                        </Button>
                      )}
                    </div>

                    {selectedPatientData ? (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                        <div className="font-semibold text-emerald-800">
                          {selectedPatientData.name}
                        </div>
                        <div className="mt-1 text-sm text-slate-600">
                          Cédula: {selectedPatientData.cedula || '—'}
                          {selectedPatientData.phone ? ` • ${selectedPatientData.phone}` : ''}
                        </div>
                      </div>
                    ) : (
                      <div className="max-h-64 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2">
                        {patientSearch.trim() === '' ? (
                          <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                            Escriba para buscar un paciente.
                          </div>
                        ) : filteredPatients.length > 0 ? (
                          filteredPatients.map((patient) => (
                            <button
                              key={patient.id}
                              type="button"
                              onClick={() => {
                                setSelectedPatient(patient.id);
                                setPatientSearch('');
                              }}
                              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-primary/40 hover:bg-primary/5"
                            >
                              <div className="font-semibold text-slate-800">{patient.name}</div>
                              <div className="mt-1 text-xs text-slate-500">
                                {patient.cedula || 'Sin cédula'}
                                {patient.email ? ` • ${patient.email}` : ''}
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                            No existen coincidencias.
                          </div>
                        )}
                      </div>
                    )}
                  </section>

                  <section className="space-y-3 border-t border-slate-200 pt-6">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <Label className="text-xs font-bold uppercase tracking-wide text-slate-700">
                          Médico solicitante
                        </Label>
                        <p className="mt-1 text-xs text-slate-500">
                          Opcional. Puede continuar sin médico.
                        </p>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        onClick={openCreateDoctor}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Nuevo médico
                      </Button>
                    </div>

                    <Select
                      value={selectedDoctor || '__none__'}
                      onValueChange={(value) =>
                        setSelectedDoctor(value === '__none__' ? '' : value)
                      }
                    >
                      <SelectTrigger className="h-12 rounded-xl border-slate-200 bg-white shadow-sm">
                        <SelectValue placeholder="Seleccione un médico" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Sin médico</SelectItem>
                        {doctors.map((doctor) => (
                          <SelectItem key={doctor.id} value={doctor.id}>
                            {doctor.nombre}
                            {doctor.especialidad ? ` — ${doctor.especialidad}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </section>
                </div>
              )}

              {orderWizardStep === 2 && (
                <div className="space-y-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <Label className="text-xs font-bold uppercase tracking-wide text-slate-700">
                        Pruebas de la orden *
                      </Label>
                      <p className="mt-1 text-sm text-slate-500">
                        Seleccione todas las pruebas que correspondan a esta orden.
                      </p>
                    </div>

                    <Badge variant="outline" className="w-fit rounded-full px-3 py-1">
                      {selectedTests.length} seleccionada
                      {selectedTests.length === 1 ? '' : 's'}
                    </Badge>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      className="h-12 rounded-xl border-slate-200 bg-white pl-10 shadow-sm"
                      placeholder="Buscar prueba o parámetro..."
                      value={testSearch}
                      onChange={(e) => setTestSearch(e.target.value)}
                    />
                  </div>

                  {filteredTestsForPicker.length > 0 ? (
                    <div className="grid grid-cols-1 gap-x-8 gap-y-6 lg:grid-cols-3">
                      {groupedTestsForPicker.map((column) => (
                        <div key={column.column} className="min-w-0 space-y-5">
                          {column.sections.map((section) => (
                            <section key={section.key}>
                              <div className="mb-1 border-b-2 border-primary pb-1 text-sm font-black uppercase tracking-wide text-primary">
                                {section.title}
                              </div>

                              <div>
                                {section.tests.map((test: any) => {
                                  const isSelected = selectedTests.includes(test.id);

                                  return (
                                    <button
                                      key={test.id}
                                      type="button"
                                      onClick={() =>
                                        setSelectedTests((prev) =>
                                          prev.includes(test.id)
                                            ? prev.filter((id) => id !== test.id)
                                            : [...prev, test.id]
                                        )
                                      }
                                      className={`flex min-h-9 w-full items-center gap-2 border-b border-slate-200 px-0.5 py-1.5 text-left transition-colors ${
                                        isSelected
                                          ? 'font-semibold text-primary'
                                          : 'text-slate-800 hover:text-primary'
                                      }`}
                                    >
                                      <span
                                        className={`flex h-4 w-4 shrink-0 items-center justify-center border text-[9px] font-bold transition-colors ${
                                          isSelected
                                            ? 'border-primary bg-primary text-primary-foreground'
                                            : 'border-slate-400 bg-white text-transparent'
                                        }`}
                                        aria-hidden="true"
                                      >
                                        ✓
                                      </span>

                                      <span className="min-w-0 flex-1 text-[13px] leading-4">
                                        {test.pickerPlacement.label}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </section>
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
                      No existen pruebas que coincidan con la búsqueda.
                    </div>
                  )}
                </div>
              )}

              {orderWizardStep === 3 && (
                <div className="mx-auto max-w-4xl space-y-6">
                  <section className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-slate-900">Resumen de la orden</h3>
                        <p className="text-xs text-slate-500">
                          {selectedPatientData?.name || 'Paciente'} • {selectedTests.length}{' '}
                          prueba{selectedTests.length === 1 ? '' : 's'}
                        </p>
                      </div>
                    </div>

                    <div className="divide-y rounded-xl border border-slate-200">
                      {selectedTestsSummary.map((test) => (
                        <div
                          key={test.id}
                          className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
                        >
                          <span className="font-medium text-slate-700">
                            {test.pickerLabel || getOrderPickerTestLabel(test)}
                          </span>
                          <span className="font-semibold text-slate-800">
                            ${Number(test.subtotalOriginal || 0).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-5">
                    <div>
                      <h3 className="font-semibold text-slate-900">Descuento global</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Se aplica una sola vez sobre el subtotal completo de la orden.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[180px_1fr]">
                      <Select
                        value={globalDiscountType}
                        onValueChange={(value: GlobalDiscountType) => {
                          setGlobalDiscountType(value);
                          setGlobalDiscount('');
                        }}
                      >
                        <SelectTrigger className="h-12 rounded-xl bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="VALUE">Valor ($)</SelectItem>
                          <SelectItem value="PERCENT">Porcentaje (%)</SelectItem>
                        </SelectContent>
                      </Select>

                      <Input
                        type="number"
                        min="0"
                        max={globalDiscountType === 'PERCENT' ? 100 : undefined}
                        step="0.01"
                        value={globalDiscount}
                        onChange={(e) => setGlobalDiscount(e.target.value)}
                        placeholder={globalDiscountType === 'PERCENT' ? '0.00 %' : '0.00'}
                        className="h-12 rounded-xl bg-white"
                      />
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4 text-sm space-y-2">
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-500">Subtotal original</span>
                        <span className="font-medium">
                          ${resumenTotales.subtotalOriginal.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-500">Descuento</span>
                        <span className="font-medium text-emerald-700">
                          -${resumenTotales.descuento.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-500">Subtotal neto</span>
                        <span className="font-medium">${resumenTotales.subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-500">IVA</span>
                        <span className="font-medium">${resumenTotales.iva.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between gap-4 border-t border-slate-200 pt-3">
                        <span className="font-bold text-slate-900">Total</span>
                        <span className="text-xl font-black text-primary">
                          ${resumenTotales.total.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="font-semibold text-slate-900">Pago</h3>
                        <p className="mt-1 text-xs text-slate-500">
                          Puede cobrar todo, registrar un abono o dejar la orden pendiente.
                        </p>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-fit rounded-xl"
                        onClick={() =>
                          setInitialPaymentForm((form) => ({
                            ...form,
                            amount: resumenTotales.total.toFixed(2),
                          }))
                        }
                        disabled={resumenTotales.total <= 0}
                      >
                        <Wallet className="mr-2 h-4 w-4" />
                        Pagar total
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider">
                          Monto a pagar ahora
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max={resumenTotales.total}
                          value={initialPaymentForm.amount}
                          onChange={(e) =>
                            setInitialPaymentForm((form) => ({
                              ...form,
                              amount: e.target.value,
                            }))
                          }
                          placeholder="0.00"
                          className="h-12 rounded-xl"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider">
                          Método de pago
                        </Label>
                        <Select
                          value={initialPaymentForm.payment_method}
                          onValueChange={(value) =>
                            setInitialPaymentForm((form) => ({
                              ...form,
                              payment_method: value,
                            }))
                          }
                        >
                          <SelectTrigger className="h-12 rounded-xl bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                            <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                            <SelectItem value="TARJETA">Tarjeta</SelectItem>
                            <SelectItem value="DEPOSITO">Depósito</SelectItem>
                            <SelectItem value="OTRO">Otro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider">
                          Referencia
                        </Label>
                        <Input
                          value={initialPaymentForm.reference}
                          onChange={(e) =>
                            setInitialPaymentForm((form) => ({
                              ...form,
                              reference: e.target.value,
                            }))
                          }
                          placeholder="Voucher, transferencia, etc."
                          className="h-12 rounded-xl"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider">
                          Observación
                        </Label>
                        <Input
                          value={initialPaymentForm.notes}
                          onChange={(e) =>
                            setInitialPaymentForm((form) => ({
                              ...form,
                              notes: e.target.value,
                            }))
                          }
                          placeholder="Opcional"
                          className="h-12 rounded-xl"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
                      <div>
                        <div className="text-[11px] uppercase text-slate-500">Total</div>
                        <div className="mt-1 font-bold">${resumenTotales.total.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase text-slate-500">Pago</div>
                        <div className="mt-1 font-bold">
                          ${round2(Number(initialPaymentForm.amount || 0)).toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase text-slate-500">Saldo</div>
                        <div className="mt-1 font-bold text-primary">
                          $
                          {round2(
                            Math.max(
                              resumenTotales.total -
                                round2(Number(initialPaymentForm.amount || 0)),
                              0
                            )
                          ).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-5">
                    <div>
                      <h3 className="font-semibold text-slate-900">Datos de facturación</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Seleccione a nombre de quién se emitirá la factura cuando corresponda.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <button
                        type="button"
                        onClick={() => setBillingMode('PACIENTE')}
                        className={`rounded-2xl border p-4 text-left transition ${
                          billingMode === 'PACIENTE'
                            ? 'border-primary bg-primary/5'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="font-semibold">Paciente</div>
                        <div className="mt-1 text-xs text-slate-500">
                          Usar los datos del paciente
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setBillingMode('CONSUMIDOR_FINAL')}
                        className={`rounded-2xl border p-4 text-left transition ${
                          billingMode === 'CONSUMIDOR_FINAL'
                            ? 'border-primary bg-primary/5'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="font-semibold">Consumidor final</div>
                        <div className="mt-1 text-xs text-slate-500">
                          Usar datos estándar
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setBillingMode('OTRO');
                          setBillingCustomerId(null);
                          setBillingFoundMessage('');
                          setBillingForm({
                            tipo_identificacion: 'CEDULA',
                            identificacion: '',
                            nombres: '',
                            direccion: '',
                            telefono: '',
                            email: '',
                          });
                        }}
                        className={`rounded-2xl border p-4 text-left transition ${
                          billingMode === 'OTRO'
                            ? 'border-primary bg-primary/5'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="font-semibold">Otro cliente</div>
                        <div className="mt-1 text-xs text-slate-500">
                          Buscar o registrar datos
                        </div>
                      </button>
                    </div>

                    <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold uppercase tracking-wider">
                            Tipo de identificación
                          </Label>
                          <Select
                            value={billingForm.tipo_identificacion}
                            onValueChange={(value: BillingIdType) => {
                              setBillingCustomerId(null);
                              setBillingFoundMessage('');
                              setBillingForm((form) => ({
                                ...form,
                                tipo_identificacion: value,
                                identificacion:
                                  value === 'CONSUMIDOR_FINAL' ? '9999999999999' : '',
                              }));
                            }}
                            disabled={billingMode !== 'OTRO'}
                          >
                            <SelectTrigger className="bg-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="CEDULA">Cédula</SelectItem>
                              <SelectItem value="RUC">RUC</SelectItem>
                              <SelectItem value="PASAPORTE">Pasaporte</SelectItem>
                              <SelectItem value="CONSUMIDOR_FINAL">
                                Consumidor final
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs font-semibold uppercase tracking-wider">
                            Identificación
                          </Label>
                          <div className="relative">
                            <Input
                              value={billingForm.identificacion}
                              onChange={(e) =>
                                setBillingForm((form) => ({
                                  ...form,
                                  identificacion: e.target.value,
                                }))
                              }
                              onBlur={() => {
                                if (billingMode === 'OTRO') {
                                  buscarClienteFacturacion(
                                    billingForm.identificacion,
                                    billingForm.tipo_identificacion
                                  );
                                }
                              }}
                              disabled={billingMode !== 'OTRO'}
                              placeholder="Identificación"
                              className="bg-white pr-10"
                            />
                            {billingLookupLoading && (
                              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                            )}
                          </div>
                        </div>
                      </div>

                      {billingFoundMessage && (
                        <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                          {billingFoundMessage}
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider">
                          Nombres / Razón social
                        </Label>
                        <Input
                          value={billingForm.nombres}
                          onChange={(e) =>
                            setBillingForm((form) => ({ ...form, nombres: e.target.value }))
                          }
                          disabled={
                            billingMode === 'PACIENTE' ||
                            billingMode === 'CONSUMIDOR_FINAL'
                          }
                          className="bg-white"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider">
                          Dirección
                        </Label>
                        <Textarea
                          rows={2}
                          value={billingForm.direccion}
                          onChange={(e) =>
                            setBillingForm((form) => ({ ...form, direccion: e.target.value }))
                          }
                          disabled={
                            billingMode === 'PACIENTE' ||
                            billingMode === 'CONSUMIDOR_FINAL'
                          }
                          className="bg-white"
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold uppercase tracking-wider">
                            Teléfono
                          </Label>
                          <Input
                            value={billingForm.telefono}
                            onChange={(e) =>
                              setBillingForm((form) => ({
                                ...form,
                                telefono: e.target.value,
                              }))
                            }
                            disabled={
                              billingMode === 'PACIENTE' ||
                              billingMode === 'CONSUMIDOR_FINAL'
                            }
                            className="bg-white"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs font-semibold uppercase tracking-wider">
                            Email
                          </Label>
                          <Input
                            type="email"
                            value={billingForm.email}
                            onChange={(e) =>
                              setBillingForm((form) => ({ ...form, email: e.target.value }))
                            }
                            disabled={
                              billingMode === 'PACIENTE' ||
                              billingMode === 'CONSUMIDOR_FINAL'
                            }
                            className="bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              )}
            </div>

            <div className="shrink-0 border-t bg-white px-5 py-4 sm:px-7">
              <div className="flex items-center justify-between gap-3">
                {orderWizardStep > 1 ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-xl px-5"
                    onClick={() =>
                      setOrderWizardStep((orderWizardStep - 1) as OrderWizardStep)
                    }
                    disabled={creating}
                  >
                    Anterior
                  </Button>
                ) : (
                  <div />
                )}

                {orderWizardStep < 3 ? (
                  <Button
                    type="button"
                    className="h-11 rounded-xl px-6 gradient-clinical text-primary-foreground border-0"
                    onClick={() =>
                      goToOrderWizardStep((orderWizardStep + 1) as OrderWizardStep)
                    }
                    disabled={
                      (orderWizardStep === 1 && !selectedPatient) ||
                      (orderWizardStep === 2 && selectedTests.length === 0)
                    }
                  >
                    Siguiente
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handleCreate}
                    className="h-11 rounded-xl px-7 gradient-clinical text-primary-foreground border-0 shadow-md"
                    disabled={!selectedPatient || selectedTests.length === 0 || creating}
                  >
                    {creating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generando...
                      </>
                    ) : (
                      'Finalizar orden'
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={patientDialogOpen} onOpenChange={setPatientDialogOpen}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              Nuevo Registro de Paciente
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="font-semibold text-xs uppercase tracking-wider">
                Nombre Completo *
              </Label>
              <Input
                value={patientForm.name}
                onChange={(e) => setPatientForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Nombres y Apellidos"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-semibold text-xs uppercase tracking-wider">
                  Cédula *
                </Label>
                <Input
                  value={patientForm.cedula}
                  onChange={(e) => setPatientForm((f) => ({ ...f, cedula: e.target.value }))}
                  placeholder="ID única"
                />
              </div>

              <div className="space-y-2">
                <Label className="font-semibold text-xs uppercase tracking-wider">
                  Teléfono
                </Label>
                <Input
                  value={patientForm.phone}
                  onChange={(e) => setPatientForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="0987654321"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-semibold text-xs uppercase tracking-wider">
                Correo Electrónico
              </Label>
              <Input
                type="email"
                value={patientForm.email}
                onChange={(e) => setPatientForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="paciente@ejemplo.com"
              />
            </div>

            <div className="space-y-2">
              <Label className="font-semibold text-xs uppercase tracking-wider">
                Dirección
              </Label>
              <Textarea
                value={patientForm.direccion}
                onChange={(e) => setPatientForm((f) => ({ ...f, direccion: e.target.value }))}
                placeholder="Dirección del paciente"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-semibold text-xs uppercase tracking-wider">
                  Fecha de Nacimiento *
                </Label>
                <Input
                  type="date"
                  value={patientForm.birth_date}
                  onChange={(e) => setPatientForm((f) => ({ ...f, birth_date: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label className="font-semibold text-xs uppercase tracking-wider">
                  Sexo *
                </Label>
                <Select
                  value={patientForm.sex}
                  onValueChange={(v: 'M' | 'F') => setPatientForm((f) => ({ ...f, sex: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Masculino</SelectItem>
                    <SelectItem value="F">Femenino</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={handleSavePatient}
              className="w-full gradient-clinical text-primary-foreground border-0 h-11 mt-4"
              disabled={creatingPatient}
            >
              {creatingPatient ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Registrando...
                </>
              ) : (
                'Registrar Paciente'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={doctorDialogOpen} onOpenChange={setDoctorDialogOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              Nuevo médico
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="font-semibold text-xs uppercase tracking-wider">
                Nombre completo *
              </Label>
              <Input
                value={doctorForm.nombre}
                onChange={(e) => setDoctorForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Nombre del médico"
              />
            </div>

            <div className="space-y-2">
              <Label className="font-semibold text-xs uppercase tracking-wider">
                Especialidad
              </Label>
              <Input
                value={doctorForm.especialidad}
                onChange={(e) => setDoctorForm((f) => ({ ...f, especialidad: e.target.value }))}
                placeholder="Especialidad"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-semibold text-xs uppercase tracking-wider">
                  Teléfono
                </Label>
                <Input
                  value={doctorForm.telefono}
                  onChange={(e) => setDoctorForm((f) => ({ ...f, telefono: e.target.value }))}
                  placeholder="0999999999"
                />
              </div>

              <div className="space-y-2">
                <Label className="font-semibold text-xs uppercase tracking-wider">
                  Correo
                </Label>
                <Input
                  type="email"
                  value={doctorForm.email}
                  onChange={(e) => setDoctorForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="doctor@correo.com"
                />
              </div>
            </div>

            <Button
              onClick={handleSaveDoctor}
              className="w-full gradient-clinical text-primary-foreground border-0 h-11"
              disabled={savingDoctor}
            >
              {savingDoctor ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Registrar médico'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Registrar Pago</DialogTitle>
          </DialogHeader>

          {paymentOrder && (
            <div className="space-y-4 pt-2">
              <div className="rounded-xl border bg-slate-50 p-4 space-y-2 text-sm">
                <div><b>Orden:</b> {paymentOrder.code}</div>
                <div><b>Paciente:</b> {paymentOrder.pacientes?.name}</div>
                <div><b>Médico:</b> {paymentOrder.doctores?.nombre || 'No asignado'}</div>
                <div><b>Total:</b> ${Number(paymentOrder.total || 0).toFixed(2)}</div>
                <div><b>Pagado:</b> ${Number(paymentOrder.paid_amount || 0).toFixed(2)}</div>
                <div>
                  <b>Saldo:</b> $
                  {(
                    Number(paymentOrder.total || 0) - Number(paymentOrder.paid_amount || 0)
                  ).toFixed(2)}
                </div>
                <div>
                  <b>Estado de pago:</b> {paymentOrder.payment_status || 'PENDIENTE'}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="font-semibold text-xs uppercase tracking-wider">Monto *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={paymentForm.amount}
                  onChange={(e) =>
                    setPaymentForm((f) => ({ ...f, amount: e.target.value }))
                  }
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label className="font-semibold text-xs uppercase tracking-wider">
                  Método de Pago *
                </Label>
                <Select
                  value={paymentForm.payment_method}
                  onValueChange={(v) =>
                    setPaymentForm((f) => ({ ...f, payment_method: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                    <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                    <SelectItem value="TARJETA">Tarjeta</SelectItem>
                    <SelectItem value="DEPOSITO">Depósito</SelectItem>
                    <SelectItem value="OTRO">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="font-semibold text-xs uppercase tracking-wider">
                  Referencia
                </Label>
                <Input
                  value={paymentForm.reference}
                  onChange={(e) =>
                    setPaymentForm((f) => ({ ...f, reference: e.target.value }))
                  }
                  placeholder="Número de transferencia, voucher, etc."
                />
              </div>

              <div className="space-y-2">
                <Label className="font-semibold text-xs uppercase tracking-wider">
                  Observación
                </Label>
                <Textarea
                  rows={3}
                  value={paymentForm.notes}
                  onChange={(e) =>
                    setPaymentForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  placeholder="Comentario opcional"
                />
              </div>

              <div className="space-y-2">
                <Label className="font-semibold text-xs uppercase tracking-wider">
                  Historial de Pagos
                </Label>

                <div className="rounded-xl border divide-y">
                  {(paymentOrder.orden_pagos || []).length > 0 ? (
                    [...paymentOrder.orden_pagos]
                      .sort(
                        (a: any, b: any) =>
                          new Date(b.paid_at || b.created_at).getTime() -
                          new Date(a.paid_at || a.created_at).getTime()
                      )
                      .map((p: any) => (
                        <div key={p.id} className="p-3 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="font-semibold">{p.payment_method}</div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(p.paid_at || p.created_at).toLocaleString()}
                              </div>
                              {p.reference && (
                                <div className="text-xs text-muted-foreground">
                                  Ref: {p.reference}
                                </div>
                              )}
                            </div>
                            <div className="font-bold text-primary">
                              ${Number(p.amount || 0).toFixed(2)}
                            </div>
                          </div>
                          {p.notes && <div className="mt-1 text-xs">{p.notes}</div>}
                        </div>
                      ))
                  ) : (
                    <div className="p-4 text-sm text-muted-foreground text-center">
                      Aún no existen pagos registrados
                    </div>
                  )}
                </div>
              </div>

              <Button
                onClick={handleSavePayment}
                className="w-full gradient-clinical text-primary-foreground border-0 h-11"
                disabled={savingPayment}
              >
                {savingPayment ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Registrar Pago'
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Detalle de Factura</DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4 text-sm">
              {selectedOrder.factura_estado === 'EN_PROCESAMIENTO' && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  La factura ya fue enviada al SRI y continúa en procesamiento. No debe reenviarse;
                  solo reconsultar su autorización.
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs uppercase text-muted-foreground">Orden</Label>
                  <div className="font-semibold">{selectedOrder.code}</div>
                </div>

                <div>
                  <Label className="text-xs uppercase text-muted-foreground">Paciente</Label>
                  <div className="font-semibold">{selectedOrder.pacientes?.name}</div>
                </div>

                <div>
                  <Label className="text-xs uppercase text-muted-foreground">Médico</Label>
                  <div className="font-semibold">
                    {selectedOrder.doctores?.nombre || 'No asignado'}
                  </div>
                </div>

                <div>
                  <Label className="text-xs uppercase text-muted-foreground">Número de factura</Label>
                  <div className="font-semibold">{selectedOrder.numero_factura || '—'}</div>
                </div>

                <div className="md:col-span-2 rounded-xl border bg-slate-50 p-4">
                  <div className="font-semibold mb-2">Cliente de facturación</div>
                  <div><b>Nombre:</b> {selectedOrder.factura_nombres || '—'}</div>
                  <div><b>Tipo ID:</b> {selectedOrder.factura_tipo_identificacion || '—'}</div>
                  <div><b>Identificación:</b> {selectedOrder.factura_identificacion || '—'}</div>
                  <div><b>Dirección:</b> {selectedOrder.factura_direccion || '—'}</div>
                  <div><b>Teléfono:</b> {selectedOrder.factura_telefono || '—'}</div>
                  <div><b>Email:</b> {selectedOrder.factura_email || '—'}</div>
                </div>

                <div>
                  <Label className="text-xs uppercase text-muted-foreground">Estado factura</Label>
                  <div className="font-semibold">
                    {selectedOrder.factura_estado === 'EN_PROCESAMIENTO'
                      ? 'Procesando en SRI'
                      : selectedOrder.factura_estado || '—'}
                  </div>
                </div>

                <div>
                  <Label className="text-xs uppercase text-muted-foreground">Estado de pago</Label>
                  <div className="font-semibold">
                    {selectedOrder.payment_status || 'PENDIENTE'}
                  </div>
                </div>

                <div>
                  <Label className="text-xs uppercase text-muted-foreground">Pagado</Label>
                  <div className="font-semibold">
                    ${Number(selectedOrder.paid_amount || 0).toFixed(2)}
                  </div>
                </div>

                <div>
                  <Label className="text-xs uppercase text-muted-foreground">Saldo pendiente</Label>
                  <div className="font-semibold">
                    ${(
                      Number(selectedOrder.total || 0) -
                      Number(selectedOrder.paid_amount || 0)
                    ).toFixed(2)}
                  </div>
                </div>

                <div>
                  <Label className="text-xs uppercase text-muted-foreground">Total</Label>
                  <div className="font-semibold">
                    ${Number(selectedOrder.total || 0).toFixed(2)}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <Label className="text-xs uppercase text-muted-foreground">
                    Clave de acceso SRI
                  </Label>
                  <div className="font-mono break-all">{selectedOrder.clave_acceso_sri || '—'}</div>
                </div>

                <div className="md:col-span-2">
                  <Label className="text-xs uppercase text-muted-foreground">
                    Número de autorización
                  </Label>
                  <div className="font-mono break-all">
                    {selectedOrder.numero_autorizacion_sri || '—'}
                  </div>
                </div>

                <div>
                  <Label className="text-xs uppercase text-muted-foreground">
                    Fecha autorización
                  </Label>
                  <div className="font-semibold">
                    {selectedOrder.factura_fecha_autorizacion
                      ? new Date(selectedOrder.factura_fecha_autorizacion).toLocaleString()
                      : '—'}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <Label className="text-xs uppercase text-muted-foreground">Mensaje</Label>
                  <div>{selectedOrder.factura_mensaje || '—'}</div>
                </div>

                <div className="md:col-span-2">
                  <Label className="text-xs uppercase text-muted-foreground">XML Autorizado</Label>
                  <div className="break-all">
                    {selectedOrder.factura_xml_autorizado_path ||
                      selectedOrder.factura_xml_firmado_path ||
                      selectedOrder.factura_xml_path ||
                      '—'}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <Label className="text-xs uppercase text-muted-foreground">PDF RIDE</Label>
                  <div className="break-all">{selectedOrder.factura_ride_pdf_path || '—'}</div>
                </div>

                <div className="md:col-span-2">
                  <Label className="text-xs uppercase text-muted-foreground">Pagos registrados</Label>
                  <div className="rounded-xl border divide-y mt-2">
                    {(selectedOrder.orden_pagos || []).length > 0 ? (
                      [...selectedOrder.orden_pagos]
                        .sort(
                          (a: any, b: any) =>
                            new Date(b.paid_at || b.created_at).getTime() -
                            new Date(a.paid_at || a.created_at).getTime()
                        )
                        .map((p: any) => (
                          <div key={p.id} className="p-3 text-sm">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="font-semibold">{p.payment_method}</div>
                                <div className="text-xs text-muted-foreground">
                                  {new Date(p.paid_at || p.created_at).toLocaleString()}
                                </div>
                                {p.reference && (
                                  <div className="text-xs text-muted-foreground">
                                    Ref: {p.reference}
                                  </div>
                                )}
                              </div>
                              <div className="font-bold text-primary">
                                ${Number(p.amount || 0).toFixed(2)}
                              </div>
                            </div>
                            {p.notes && <div className="mt-1 text-xs">{p.notes}</div>}
                          </div>
                        ))
                    ) : (
                      <div className="p-4 text-sm text-muted-foreground">
                        No hay pagos registrados.
                      </div>
                    )}
                  </div>
                </div>

                <div className="md:col-span-2 flex flex-wrap gap-2 pt-2">
                  {selectedOrder.factura_estado === 'EN_PROCESAMIENTO' && (
                    <Button
                      variant="outline"
                      onClick={() => recheckSriStatus(selectedOrder.id)}
                      disabled={checkingSri === selectedOrder.id}
                    >
                      {checkingSri === selectedOrder.id ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4 mr-2" />
                      )}
                      Reconsultar SRI
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    onClick={() => openAssignDoctorDialog(selectedOrder.id)}
                  >
                    <Stethoscope className="w-4 h-4 mr-2" />
                    {selectedOrder.doctores?.nombre ? 'Editar médico' : 'Asignar médico'}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => openPaymentDialog(selectedOrder.id)}
                  >
                    <Wallet className="w-4 h-4 mr-2" />
                    Registrar Pago
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() =>
                      openXmlFile(
                        selectedOrder.factura_xml_autorizado_path ||
                          selectedOrder.factura_xml_firmado_path ||
                          selectedOrder.factura_xml_path
                      )
                    }
                    disabled={
                      !selectedOrder.factura_xml_autorizado_path &&
                      !selectedOrder.factura_xml_firmado_path &&
                      !selectedOrder.factura_xml_path
                    }
                  >
                    <FileCode className="w-4 h-4 mr-2" />
                    Abrir XML
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => generarRideDesdeXml(selectedOrder.id, false, true)}
                    disabled={generatingRide === selectedOrder.id}
                  >
                    {generatingRide === selectedOrder.id ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Receipt className="w-4 h-4 mr-2" />
                    )}
                    Generar PDF RIDE
                  </Button>

                  <Button variant="outline" onClick={() => printThermalTicket(selectedOrder.id)}>
                    <Printer className="w-4 h-4 mr-2" />
                    Reimprimir Ticket
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={assignDoctorDialogOpen} onOpenChange={setAssignDoctorDialogOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {doctorOrder?.doctores?.nombre ? 'Editar médico de la orden' : 'Asignar médico a la orden'}
            </DialogTitle>
          </DialogHeader>

          {doctorOrder && (
            <div className="space-y-4 pt-4">
              <div className="rounded-xl border bg-slate-50 p-4 space-y-2 text-sm">
                <div><b>Orden:</b> {doctorOrder.code}</div>
                <div><b>Paciente:</b> {doctorOrder.pacientes?.name}</div>
                <div>
                  <b>Médico actual:</b> {doctorOrder.doctores?.nombre || 'No asignado'}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="font-semibold text-xs uppercase tracking-wider">
                  Médico
                </Label>

                <Select
                  value={doctorToAssign || '__none__'}
                  onValueChange={(value) =>
                    setDoctorToAssign(value === '__none__' ? '' : value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione un médico" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin médico</SelectItem>
                    {doctors.map((doctor) => (
                      <SelectItem key={doctor.id} value={doctor.id}>
                        {doctor.nombre}
                        {doctor.especialidad ? ` — ${doctor.especialidad}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={openCreateDoctor}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nuevo médico
                </Button>

                <Button
                  onClick={handleAssignDoctorToOrder}
                  className="flex-1 gradient-clinical text-primary-foreground border-0"
                  disabled={assigningDoctor}
                >
                  {assigningDoctor ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    'Guardar médico'
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}