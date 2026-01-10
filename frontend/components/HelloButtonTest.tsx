'use client';

import { useState, useEffect } from 'react';

interface Message {
  _id: string;
  message: string;
  createdAt: string;
}

export default function HelloButtonTest() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  const fetchMessages = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/test/messages`);
      const data = await response.json();
      if (data.success) {
        setMessages(data.data);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleSayHello = async () => {
    setLoading(true);
    setStatus('Sending...');

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/test/hello`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (data.success) {
        setStatus(`✅ ${data.message}`);
        fetchMessages();
      } else {
        setStatus(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      setStatus('❌ Failed to connect to backend');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h2 className="text-3xl font-bold mb-6 text-center">Backend Test</h2>

      <div className="text-center mb-6">
        <button
          onClick={handleSayHello}
          disabled={loading}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-lg disabled:opacity-50"
        >
          {loading ? 'Sending...' : '👋 Say Hello to Backend'}
        </button>
      </div>

      {status && (
        <div className={`p-4 mb-6 rounded ${status.includes('✅') ? 'bg-green-100' : 'bg-red-100'}`}>
          <p className="text-center font-semibold">{status}</p>
        </div>
      )}

      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-xl font-bold mb-4">Messages in Database ({messages.length})</h3>
        
        {messages.length === 0 ? (
          <p className="text-gray-500 text-center">No messages yet. Click the button!</p>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => (
              <div key={msg._id} className="p-4 bg-gray-50 border rounded">
                <p className="font-semibold">{msg.message}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(msg.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded">
        <p className="text-sm"><strong>Frontend:</strong> http://localhost:3000</p>
        <p className="text-sm"><strong>Backend:</strong> http://localhost:5000</p>
        <p className="text-sm"><strong>API URL:</strong> {process.env.NEXT_PUBLIC_API_URL}</p>
      </div>
    </div>
  );
}