// aktualisierte AdminCategoryPage.jsx mit axiosInstance
import React, { useEffect, useState } from 'react';
import axiosInstance from '../api/axios';

const AdminCategoryPage = () => {
  const [categories, setCategories] = useState([]);
  const [newCatName, setNewCatName] = useState('');
  const [subcatInput, setSubcatInput] = useState({});
  const [error, setError] = useState('');

  const fetchCategories = async () => {
    try {
      console.log('📡 Hole Kategorien von', import.meta.env.VITE_API_BASE_URL);
      const res = await axiosInstance.get('/categories');
      console.log('✅ Kategorien:', res.data);
      setCategories(res.data);
    } catch (err) {
      console.error('❌ Fehler beim Laden:', err);
      setError('Fehler beim Laden der Kategorien');
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const createCategory = async () => {
    if (!newCatName) return;
    try {
      await axiosInstance.post('/categories', { name: newCatName });
      setNewCatName('');
      fetchCategories();
    } catch (err) {
      console.error('❌ Fehler beim Erstellen:', err);
      setError('Fehler beim Erstellen');
    }
  };

  const deleteCategory = async (id) => {
    if (!window.confirm('Kategorie wirklich löschen?')) return;
    await axiosInstance.delete(`/categories/${id}`);
    fetchCategories();
  };

  const addSubcategory = async (id) => {
    const cat = categories.find(c => c._id === id);
    const sub = subcatInput[id]?.trim();
    if (!sub) return;

    const updated = [...cat.subcategories, sub];
    await axiosInstance.put(`/categories/${id}`, { name: cat.name, subcategories: updated });
    setSubcatInput(prev => ({ ...prev, [id]: '' }));
    fetchCategories();
  };

  const deleteSubcategory = async (catId, sub) => {
    const cat = categories.find(c => c._id === catId);
    const updated = cat.subcategories.filter(s => s !== sub);
    await axiosInstance.put(`/categories/${catId}`, { name: cat.name, subcategories: updated });
    fetchCategories();
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">🛠️ Kategorien verwalten</h1>

      {error && <p className="text-red-600 mb-2">{error}</p>}

      <div className="flex gap-2 mb-6">
        <input
          type="text"
          placeholder="Neue Kategorie"
          value={newCatName}
          onChange={(e) => setNewCatName(e.target.value)}
          className="border p-2 w-full"
        />
        <button onClick={createCategory} className="bg-blue-600 text-white px-4 rounded">Hinzufügen</button>
      </div>

      {categories.map(cat => (
        <div key={cat._id} className="mb-6 border p-4 rounded shadow">
          <div className="flex justify-between items-center mb-2">
            <h2 className="font-bold">{cat.name}</h2>
            <button onClick={() => deleteCategory(cat._id)} className="text-red-600">Löschen</button>
          </div>

          <ul className="mb-2 pl-4 list-disc">
            {cat.subcategories.map(sub => (
              <li key={sub} className="flex justify-between items-center">
                <span>{sub}</span>
                <button onClick={() => deleteSubcategory(cat._id, sub)} className="text-sm text-red-500">Entfernen</button>
              </li>
            ))}
          </ul>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Subkategorie"
              value={subcatInput[cat._id] || ''}
              onChange={(e) =>
                setSubcatInput(prev => ({ ...prev, [cat._id]: e.target.value }))
              }
              className="border p-2 w-full"
            />
            <button onClick={() => addSubcategory(cat._id)} className="bg-green-600 text-white px-4 rounded">+</button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AdminCategoryPage;
