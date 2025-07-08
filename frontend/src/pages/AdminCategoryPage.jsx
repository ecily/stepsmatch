// vollständige AdminCategoryPage.jsx mit Bearbeiten + Drag & Drop
import React, { useEffect, useState } from 'react';
import axiosInstance from '../api/axios';
import {
  DragDropContext,
  Droppable,
  Draggable,
} from '@hello-pangea/dnd';

const AdminCategoryPage = () => {
  const [categories, setCategories] = useState([]);
  const [newCatName, setNewCatName] = useState('');
  const [subcatInput, setSubcatInput] = useState({});
  const [editingSubcat, setEditingSubcat] = useState(null);
  const [error, setError] = useState('');

  const fetchCategories = async () => {
    try {
      const res = await axiosInstance.get('/categories');
      setCategories(res.data);
    } catch (err) {
      setError('Fehler beim Laden der Kategorien');
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const createCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      await axiosInstance.post('/categories', { name: newCatName.trim() });
      setNewCatName('');
      fetchCategories();
    } catch (err) {
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

  const startEditingSub = (catId, sub) => {
    setEditingSubcat({ catId, oldName: sub, value: sub });
  };

  const cancelEditingSub = () => {
    setEditingSubcat(null);
  };

  const saveEditingSub = async () => {
    const { catId, oldName, value } = editingSubcat;
    if (!value.trim()) return;
    const cat = categories.find(c => c._id === catId);
    const updated = cat.subcategories.map(s => (s === oldName ? value.trim() : s));
    await axiosInstance.put(`/categories/${catId}`, { name: cat.name, subcategories: updated });
    setEditingSubcat(null);
    fetchCategories();
  };

  const onDragEnd = async (result, catId) => {
    if (!result.destination) return;
    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;
    const cat = categories.find(c => c._id === catId);
    const reordered = Array.from(cat.subcategories);
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(destIndex, 0, moved);
    await axiosInstance.put(`/categories/${catId}`, { name: cat.name, subcategories: reordered });
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
            <h2 className="font-bold text-lg">{cat.name}</h2>
            <button onClick={() => deleteCategory(cat._id)} className="text-red-600">Löschen</button>
          </div>

          <DragDropContext onDragEnd={(result) => onDragEnd(result, cat._id)}>
            <Droppable droppableId={cat._id}>
              {(provided) => (
                <ul
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="mb-2 pl-4 list-disc space-y-1"
                >
                  {cat.subcategories.map((sub, index) => {
                    const isEditing = editingSubcat?.catId === cat._id && editingSubcat?.oldName === sub;
                    return (
                      <Draggable key={sub} draggableId={sub} index={index}>
                        {(provided) => (
                          <li
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className="flex justify-between items-center gap-2 bg-white border p-1 rounded"
                          >
                            {isEditing ? (
                              <>
                                <input
                                  type="text"
                                  value={editingSubcat.value}
                                  onChange={(e) => setEditingSubcat(prev => ({ ...prev, value: e.target.value }))}
                                  className="border p-1 flex-grow"
                                />
                                <button onClick={saveEditingSub} className="text-green-600 text-sm">Speichern</button>
                                <button onClick={cancelEditingSub} className="text-gray-600 text-sm">Abbrechen</button>
                              </>
                            ) : (
                              <>
                                <span className="flex-grow">{sub}</span>
                                <button onClick={() => startEditingSub(cat._id, sub)} className="text-blue-600 text-sm">Bearbeiten</button>
                                <button onClick={() => deleteSubcategory(cat._id, sub)} className="text-red-500 text-sm">Entfernen</button>
                              </>
                            )}
                          </li>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </ul>
              )}
            </Droppable>
          </DragDropContext>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Subkategorie"
              value={subcatInput[cat._id] || ''}
              onChange={(e) => setSubcatInput(prev => ({ ...prev, [cat._id]: e.target.value }))}
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
