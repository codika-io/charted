export type Domain = 'mathematics' | 'computer-science' | 'physics' | 'chemistry' | 'biology';

export function getDomainFromId(topicId: string): Domain {
  const root = topicId.split('/')[0];
  if (root === 'computer-science') return 'computer-science';
  if (root === 'physics') return 'physics';
  if (root === 'chemistry') return 'chemistry';
  if (root === 'biology') return 'biology';
  return 'mathematics';
}

export function getDomainLabel(domain: Domain): string {
  switch (domain) {
    case 'mathematics': return 'Mathematics';
    case 'computer-science': return 'Computer Science';
    case 'physics': return 'Physics';
    case 'chemistry': return 'Chemistry';
    case 'biology': return 'Biology';
  }
}
