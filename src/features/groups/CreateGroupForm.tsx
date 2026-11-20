import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../../services/api';
import { categoryLabels, categoryList } from './categories';

const schema = z.object({
  name: z.string().trim().min(1, 'Group name is required').max(50, 'Group name is too long (max 50 characters)'),
  category: z.enum(['flatmates', 'travel', 'friends_family']),
  friends: z.string(), // names separated by commas, e.g. "Riya, Kabir"
});
type FormValues = z.infer<typeof schema>;

export default function CreateGroupForm({ onDone }: { onDone: (created: boolean) => void }) {
  const [storeError, setStoreError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', category: 'friends_family', friends: '' },
  });

  async function onSubmit(values: FormValues) {
    try {
      await api('POST', '/api/groups', {
        name: values.name,
        category: values.category,
        memberNames: values.friends.split(',').map((n) => n.trim()).filter(Boolean),
      });
      onDone(true);
    } catch (e) {
      setStoreError(e instanceof Error ? e.message : 'Could not create the group');
    }
  }

  const inputClass =
    'w-full input !w-auto focus:outline-none focus:ring-2 focus:ring-brand-500';

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="card p-6 space-y-4">
      <h2 className="text-lg font-semibold">New group</h2>

      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-1">
          Group name
        </label>
        <input id="name" type="text" placeholder="e.g. Goa Trip" className={inputClass} {...register('name')} />
        {errors.name && <p className="text-sm text-owe mt-1">{errors.name.message}</p>}
      </div>

      <div>
        <label htmlFor="category" className="block text-sm font-medium mb-1">
          Category
        </label>
        <select id="category" className={inputClass} {...register('category')}>
          {categoryList.map((c) => (
            <option key={c} value={c}>
              {categoryLabels[c]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="friends" className="block text-sm font-medium mb-1">
          Friends (separate names with commas)
        </label>
        <input id="friends" type="text" placeholder="Riya, Kabir, Meera" className={inputClass} {...register('friends')} />
        <p className="text-xs text-slate-500 mt-1">You are added automatically. You can add more people later.</p>
      </div>

      {storeError && <p className="text-sm text-owe">{storeError}</p>}

      <div className="flex gap-2">
        <button type="submit" className="btn-primary">
          Create group
        </button>
        <button type="button" onClick={() => onDone(false)} className="btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}
