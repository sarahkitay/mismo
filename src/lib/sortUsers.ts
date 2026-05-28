/** Sort people alphabetically by last name, then first name (ascending). */
export function compareByLastFirstName(
  a: { firstName: string; lastName: string },
  b: { firstName: string; lastName: string }
): number {
  const byLast = a.lastName.localeCompare(b.lastName, undefined, { sensitivity: 'base' });
  if (byLast !== 0) return byLast;
  return a.firstName.localeCompare(b.firstName, undefined, { sensitivity: 'base' });
}
