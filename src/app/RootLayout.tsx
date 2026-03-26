import { Outlet } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";

export default function RootLayout() {
  return (
    <AuthProvider>
      {/* The Outlet will render the matched child route */}
      <Outlet />
    </AuthProvider>
  );
}