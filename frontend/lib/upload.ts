const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';

/**
 * Uploads a file to the backend and returns the hosted URL.
 * @param file - The File object to upload
 * @param folder - Subfolder to store the file in (e.g. 'pets', 'profiles', 'medical-records')
 */
export async function uploadImage(file: File, folder = 'general'): Promise<string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

  const formData = new FormData();
  formData.append('image', file);

  const res = await fetch(`${API_BASE_URL}/upload?folder=${encodeURIComponent(folder)}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  const data = await res.json();
  if (data.status !== 'SUCCESS') {
    throw new Error(data.message || 'Upload failed');
  }
  return data.url as string;
}
