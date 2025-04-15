import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const res = await axios.post('http://localhost:5000/api/auth/login', formData);

      const userId = res.data.provider._id;
      if (!userId) throw new Error('userId fehlt in der Login-Antwort');

      localStorage.setItem('userId', userId);

      // ➕ Hole zugehörigen Anbieter (per userId)
      const providerRes = await axios.get(`http://localhost:5000/api/providers/user/${userId}`);
      const providerId = providerRes.data._id;

      // ✅ Weiterleitung zum richtigen Dashboard
      navigate(`/dashboard/${providerId}`);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || err.message || 'Login fehlgeschlagen');
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12 p-6 bg-white rounded shadow-md">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Login</h2>
      {error && <p className="text-red-500 mb-2">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email"
          name="email"
          placeholder="E-Mail"
          value={formData.email}
          onChange={handleChange}
          required
          className="w-full p-2 border rounded"
        />
        <input
          type="password"
          name="password"
          placeholder="Passwort"
          value={formData.password}
          onChange={handleChange}
          required
          className="w-full p-2 border rounded"
        />
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
        >
          Einloggen
        </button>
      </form>
    </div>
  );
};

export default Login;


