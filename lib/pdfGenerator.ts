import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface PDFStudentResult {
  roll_no: string;
  name: string;
  division: string;
  branch?: string;
  is_submitted: number | boolean;
  total_score: number;
  max_total: number;
  questions?: Array<{
    title: string;
    marks_awarded: number | null;
    max_marks: number;
    status?: string;
  }>;
}

export interface PDFTestMetadata {
  title: string;
  subject_name?: string;
  target_division?: string;
  duration_minutes?: number;
  total_marks?: number;
}

export function generateCollegeResultsPDF(
  metadata: PDFTestMetadata,
  results: PDFStudentResult[]
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2;

  // Header - College Emblem & Information
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(130, 20, 20); // Deep Maroon Zeal Accent
  doc.text("ZEAL EDUCATION SOCIETY'S", pageWidth / 2, 14, { align: 'center' });

  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.text('ZEAL COLLEGE OF ENGINEERING & RESEARCH, PUNE', pageWidth / 2, 20, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Survey No. 39, Narhe, Pune - 411041 | Approved by AICTE, Affiliated to SPPU Pune', pageWidth / 2, 25, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text('DEPARTMENT OF ARTIFICIAL INTELLIGENCE & DATA SCIENCE', pageWidth / 2, 30, { align: 'center' });

  // Divider Line
  doc.setDrawColor(203, 213, 225); // Slate 300
  doc.setLineWidth(0.5);
  doc.line(marginX, 33, pageWidth - marginX, 33);

  // Document Title Banner
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('OFFICIAL ACADEMIC EVALUATION REPORT & MARKSHEET', pageWidth / 2, 39, { align: 'center' });

  // Meta Information Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(marginX, 42, contentWidth, 22, 2, 2, 'FD');

  const now = new Date();
  const dateFormatted = now.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Assessment Title:', marginX + 4, 47);
  doc.text('Subject Name:', marginX + 4, 53);
  doc.text('Target Division:', marginX + 4, 59);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(metadata.title || 'Practical Assessment', marginX + 32, 47);
  doc.text(metadata.subject_name || 'Data Structures & Algorithms', marginX + 32, 53);
  doc.text(metadata.target_division || 'All Divisions', marginX + 32, 59);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Max Marks:', marginX + 105, 47);
  doc.text('Duration:', marginX + 105, 53);
  doc.text('Date of Report:', marginX + 105, 59);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(`${metadata.total_marks || 30} Marks`, marginX + 130, 47);
  doc.text(`${metadata.duration_minutes || 60} Minutes`, marginX + 130, 53);
  doc.text(dateFormatted, marginX + 130, 59);

  // Summary Statistics
  const totalStudents = results.length;
  const submittedCount = results.filter(r => Boolean(r.is_submitted)).length;
  const absentCount = totalStudents - submittedCount;
  const submittedScores = results.filter(r => Boolean(r.is_submitted)).map(r => r.total_score);
  const avgScore = submittedCount > 0
    ? (submittedScores.reduce((a, b) => a + b, 0) / submittedCount).toFixed(1)
    : '0.0';
  const highestScore = submittedScores.length > 0 ? Math.max(...submittedScores) : 0;
  const maxMarks = metadata.total_marks || 30;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(
    `Summary: Total Candidates: ${totalStudents}  |  Appeared: ${submittedCount}  |  Absent: ${absentCount}  |  Class Average: ${avgScore}/${maxMarks}  |  Highest Score: ${highestScore}/${maxMarks}`,
    marginX,
    69
  );

  // Determine question headers
  const maxQuestions = Math.max(...results.map(r => r.questions?.length || 0), 3);
  const qCols = Array.from({ length: Math.min(maxQuestions, 3) }, (_, i) => `Q${i + 1}`);

  // Sort students naturally by Roll Number
  const sorted = [...results].sort((a, b) => a.roll_no.localeCompare(b.roll_no, undefined, { numeric: true }));

  // Prepare table data
  const head = [['Sr.', 'Roll No', 'Student Name', 'Div', ...qCols, 'Total', '%', 'Status']];
  const body = sorted.map((st, idx) => {
    const isSubmitted = Boolean(st.is_submitted);
    const qMarks = qCols.map((_, qi) => {
      if (!isSubmitted) return '—';
      const q = st.questions?.[qi];
      return q && q.marks_awarded !== null && q.marks_awarded !== undefined ? `${q.marks_awarded}` : '0';
    });

    const totalText = isSubmitted ? `${st.total_score}/${maxMarks}` : '0/' + maxMarks;
    const percentage = isSubmitted && maxMarks > 0 ? `${((st.total_score / maxMarks) * 100).toFixed(1)}%` : '0.0%';
    const statusText = isSubmitted ? 'SUBMITTED' : 'ABSENT';

    return [
      String(idx + 1),
      st.roll_no,
      st.name,
      st.division || '—',
      ...qMarks,
      totalText,
      percentage,
      statusText,
    ];
  });

  // Render Table
  autoTable(doc, {
    startY: 72,
    head: head,
    body: body,
    margin: { left: marginX, right: marginX, bottom: 28 },
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: 2,
      textColor: [30, 41, 59],
      lineColor: [203, 213, 225],
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: [30, 41, 59], // Dark Navy
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'center', cellWidth: 20, fontStyle: 'bold' },
      2: { halign: 'left', cellWidth: 48 },
      3: { halign: 'center', cellWidth: 12 },
      4: { halign: 'center', cellWidth: 14 },
      5: { halign: 'center', cellWidth: 14 },
      6: { halign: 'center', cellWidth: 14 },
      7: { halign: 'center', cellWidth: 18, fontStyle: 'bold' },
      8: { halign: 'center', cellWidth: 14 },
      9: { halign: 'center', cellWidth: 18 },
    },
    didParseCell: (data) => {
      // Color status column
      if (data.section === 'body' && data.column.index === 9) {
        if (data.cell.raw === 'SUBMITTED') {
          data.cell.styles.textColor = [22, 101, 52]; // Dark green
          data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.textColor = [153, 27, 27]; // Dark red
        }
      }
    },
    didDrawPage: (data) => {
      // Running Footer on every page
      const pageNumber = data.pageNumber;
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);

      // Footer divider
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(marginX, pageHeight - 12, pageWidth - marginX, pageHeight - 12);

      doc.text(
        'Zeal Education Society • Department of AI&DS • CodeDSA Assessment Portal (Official Record)',
        marginX,
        pageHeight - 8
      );
      doc.text(
        `Page ${pageNumber}`,
        pageWidth - marginX,
        pageHeight - 8,
        { align: 'right' }
      );
    },
  });

  // Signatures on the final page
  const finalY = (doc as any).lastAutoTable?.finalY || 200;
  let sigY = finalY + 18;

  // If signatures would overflow page, add new page
  if (sigY > pageHeight - 30) {
    doc.addPage();
    sigY = 30;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);

  const sigColWidth = contentWidth / 3;

  // Faculty Signature
  doc.line(marginX + 6, sigY, marginX + sigColWidth - 10, sigY);
  doc.text('Subject Faculty Signature', marginX + sigColWidth / 2 - 2, sigY + 5, { align: 'center' });

  // Coordinator Signature
  doc.line(marginX + sigColWidth + 6, sigY, marginX + sigColWidth * 2 - 10, sigY);
  doc.text('Exam In-Charge / Coordinator', marginX + sigColWidth * 1.5, sigY + 5, { align: 'center' });

  // HOD Signature
  doc.line(marginX + sigColWidth * 2 + 6, sigY, pageWidth - marginX - 6, sigY);
  doc.text('Head of Department (HOD)', marginX + sigColWidth * 2.5 + 2, sigY + 5, { align: 'center' });

  // Save the PDF
  const cleanTitle = (metadata.title || 'Assessment').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${cleanTitle}_Results_Sheet.pdf`;
  doc.save(filename);
}
