import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Order, Patient, LabTest, OrderResult, LabConfig } from '@/types';

function addHeader(doc: jsPDF, config: LabConfig) {
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(config.name, 105, 20, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(config.owner, 105, 27, { align: 'center' });
  doc.text(config.address, 105, 32, { align: 'center' });
  doc.text(`RUC: ${config.ruc} | Reg. Sanitario: ${config.healthRegistry}`, 105, 37, { align: 'center' });
  doc.text(`Tel: ${config.phone} | ${config.schedule}`, 105, 42, { align: 'center' });
  doc.setDrawColor(30, 64, 175);
  doc.setLineWidth(0.5);
  doc.line(15, 46, 195, 46);
}

export function generateOrderPDF(order: Order, patient: Patient, orderTests: LabTest[], config: LabConfig) {
  const doc = new jsPDF();
  addHeader(doc, config);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('ORDEN DE EXÁMENES', 105, 56, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  let y = 66;
  doc.text(`Código de Orden: ${order.code}`, 15, y);
  doc.text(`Fecha: ${order.date}`, 140, y);
  y += 7;
  doc.text(`Clave de Acceso: ${order.accessKey}`, 15, y);
  y += 10;
  doc.setFont('helvetica', 'bold');
  doc.text('Datos del Paciente', 15, y);
  doc.setFont('helvetica', 'normal');
  y += 6;
  doc.text(`Nombre: ${patient.name}`, 15, y);
  doc.text(`Cédula: ${patient.cedula}`, 120, y);
  y += 6;
  doc.text(`Sexo: ${patient.sex === 'M' ? 'Masculino' : 'Femenino'}`, 15, y);
  doc.text(`Teléfono: ${patient.phone}`, 120, y);
  y += 10;

  const tableData = orderTests.map(t => [t.name, `$${t.price.toFixed(2)}`]);
  autoTable(doc, {
    startY: y,
    head: [['Prueba', 'Precio']],
    body: tableData,
    foot: [['TOTAL', `$${order.total.toFixed(2)}`]],
    headStyles: { fillColor: [30, 64, 175], fontSize: 10 },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    margin: { left: 15, right: 15 },
    theme: 'grid',
  });

  doc.save(`orden_${order.code}.pdf`);
}

export function generateResultsPDF(order: Order, patient: Patient, orderTests: LabTest[], orderResults: OrderResult[], config: LabConfig, age: number) {
  const doc = new jsPDF();
  addHeader(doc, config);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('RESULTADOS DE LABORATORIO', 105, 56, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  let y = 66;
  doc.text(`Orden: ${order.code}`, 15, y);
  doc.text(`Fecha: ${order.date}`, 140, y);
  y += 7;
  doc.text(`Paciente: ${patient.name}`, 15, y);
  y += 6;
  doc.text(`Edad: ${age} años | Sexo: ${patient.sex === 'M' ? 'Masculino' : 'Femenino'}`, 15, y);
  y += 10;

  orderTests.forEach(test => {
    const result = orderResults.find(r => r.testId === test.id);
    if (!result) return;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(test.name, 15, y);
    y += 4;

    const tableData = test.parameters.map(param => {
      const detail = result.details.find(d => d.parameterId === param.id);
      return [
        param.name,
        detail ? `${detail.value}` : '-',
        param.unit,
        detail?.appliedRange ? `${detail.appliedRange.min} - ${detail.appliedRange.max}` : 'N/A',
        detail ? (detail.status === 'normal' ? 'Normal' : detail.status === 'high' ? 'ALTO' : 'BAJO') : '-',
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [['Parámetro', 'Resultado', 'Unidad', 'Rango Referencia', 'Estado']],
      body: tableData,
      headStyles: { fillColor: [30, 64, 175], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      margin: { left: 15, right: 15 },
      theme: 'grid',
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 4) {
          const val = data.cell.raw as string;
          if (val === 'ALTO' || val === 'BAJO') {
            data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = 'bold';
          } else if (val === 'Normal') {
            data.cell.styles.textColor = [34, 139, 94];
          }
        }
      },
    });

    y = (doc as any).lastAutoTable.finalY + 10;

    if (y > 250) {
      doc.addPage();
      y = 20;
    }
  });

  doc.save(`resultados_${order.code}.pdf`);
}
