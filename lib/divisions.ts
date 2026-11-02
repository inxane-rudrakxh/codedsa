/**
 * Division mapping utility for Zeal College of Engineering & Research.
 * Handles the mapping between departmental nomenclature (AIDS A, AIDS B)
 * and institute division labels (Division C / AD13 series, Division D / AD14 series).
 */

export function resolveTargetDivisionNames(target: string | null | undefined): string[] {
  if (!target) return [];
  const t = target.trim().toUpperCase();
  const matched = new Set<string>();
  matched.add(target.trim());

  if (
    t === 'C' ||
    t.includes('DIV - C') ||
    t.includes('DIV-C') ||
    t.includes('DIV C') ||
    t === 'AIDS A' ||
    t === 'A'
  ) {
    matched.add('AIDS A');
    matched.add('C');
    matched.add('A');
    matched.add('Div-C');
    matched.add('Division C');
  }

  if (
    t === 'D' ||
    t.includes('DIV - D') ||
    t.includes('DIV-D') ||
    t.includes('DIV D') ||
    t === 'AIDS B' ||
    t === 'B'
  ) {
    matched.add('AIDS B');
    matched.add('D');
    matched.add('B');
    matched.add('Div-D');
    matched.add('Division D');
  }

  return Array.from(matched);
}

export function isDivisionMatch(
  targetDivision: string | null | undefined,
  studentDivision: string | null | undefined,
  rollNumber?: string
): boolean {
  if (!targetDivision || targetDivision.trim() === '') return true;

  const resolvedTargets = resolveTargetDivisionNames(targetDivision).map(s => s.toUpperCase());

  // Derive inferred student division from roll number if studentDivision is absent
  let studentDiv = (studentDivision || '').trim().toUpperCase();
  if (!studentDiv && rollNumber) {
    const rollUpper = rollNumber.trim().toUpperCase();
    studentDiv = rollUpper.startsWith('AD14') ? 'AIDS B' : 'AIDS A';
  }

  const resolvedStudent = resolveTargetDivisionNames(studentDiv).map(s => s.toUpperCase());

  // Check if there is any intersection
  return resolvedTargets.some(t => resolvedStudent.includes(t));
}
