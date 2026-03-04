import { Outlet } from "react-router";
import Navbar from "../components/Navbar";

export default function Root() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Outlet />
    </div>
  );
}
