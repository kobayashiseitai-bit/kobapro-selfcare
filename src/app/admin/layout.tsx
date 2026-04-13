import AdminAuth from "./components/AdminAuth";
import Sidebar from "./components/Sidebar";

export const metadata = {
  title: "ZERO-PAIN Admin",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminAuth>
      <div className="flex min-h-screen bg-gray-950 text-white">
        <Sidebar />
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </AdminAuth>
  );
}
