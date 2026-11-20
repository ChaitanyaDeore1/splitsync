import type { ExpenseCategory } from '../../types';

export const expenseCategoryList: ExpenseCategory[] = [
  'food',
  'groceries',
  'rent',
  'utilities',
  'travel',
  'stay',
  'other',
];

export const expenseCategoryLabels: Record<ExpenseCategory, string> = {
  food: 'Food & Drinks',
  groceries: 'Groceries',
  rent: 'Rent',
  utilities: 'Utilities',
  travel: 'Travel',
  stay: 'Stay',
  other: 'Other',
};
