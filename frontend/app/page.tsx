import HelloButtonTest from '@/components/HelloButtonTest';

export default function Home() {
  return (
    <div>
      {/* Your original header */}
      <header className="flex flex-col items-center justify-center p-12 bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
        <h1 className="text-5xl font-bold mb-4">PawSync</h1>
        <p className="text-xl">
          NFC-Enabled Centralized Pet Medical Record System
        </p>
      </header>

      {/* Test component */}
      <HelloButtonTest />
    </div>
  );
}