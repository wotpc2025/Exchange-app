import './globals.css';
import AuthProvider from '../components/SessionProvider'; // import ตัวที่เราสร้างเมื่อกี้

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}